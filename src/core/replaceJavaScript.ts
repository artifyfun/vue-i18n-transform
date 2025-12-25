import type VueI18n from './i18nFile'
import type { Message } from './transform'

// (?!\1) 指 非 ['"`]
const jsChineseRegExp = /(['"`])(((?!\1).)*[\u4e00-\u9fa5]+((?!\1).)*)\1/gim

export default function replaceJavaScript(
  content: string,
  file: string,
  VueI18nInstance: VueI18n,
  msg: Message
) {
  //替换注释部分
  let comments: Record<string, string> = {}
  let commentsIndex = 0
  content = content.replace(
    // /(\/\*([^\*\/]*|.|\n|\r)*\*\/)|(\/\/.*)/gim,
    /(\/\*(?:(?!\*\/).|[\n\r])*\*\/)|(\/\/.*)/gim,
    (match: string, _p1: any, _p2: any, offset: number, str: string) => {
      //排除掉url协议部分,貌似不排除也不影响
      if (offset > 0 && str[offset - 1] === ':') {
        return match
      }
      let commentsKey = `/*comment_${commentsIndex++}*/`
      comments[commentsKey] = match
      return commentsKey
    }
  )

  // 替换掉原本就有的i18n.t('****')
  content = content.replace(/i18n\.t\(((?!\)).)*\)/gim, (match: string) => {
    let commentsKey = `/*comment_${commentsIndex++}*/`
    comments[commentsKey] = match
    return commentsKey
  })

  // 替换掉console.log()
  content = content.replace(/console\.log\([^\)]+\)/gim, (match: string) => {
    let commentsKey = `/*comment_${commentsIndex++}*/`
    comments[commentsKey] = match
    return commentsKey
  })

  // map里的中文键值不应该被替换
  // 所以先替换含有中文键值,后面再换回来，作用和注释一样，共用一个 comments
  content = content.replace(/['"][^'"]*[\u4e00-\u9fa5]+[^'"]*['"]\s*:/gim, (match: string) => {
    let commentsKey = `/*comment_${commentsIndex++}*/`
    comments[commentsKey] = match
    return commentsKey
  })

  // 替换（可能含有中文的 require）, 作用和注释一样，共用一个 comments
  content = content.replace(/require\(((?!\)).)*\)/gim, (match: string) => {
    let commentsKey = `/*comment_${commentsIndex++}*/`
    comments[commentsKey] = match
    return commentsKey
  })

  content = content.replace(
    jsChineseRegExp,
    (_: any, prev: string, match: string, __: any, ___: any, offset: number) => {
      match = match.trim()
      let currentKey
      let result = ''
      if (prev !== '`') {
        //对于普通字符串的替换
        currentKey = VueI18nInstance.getCurrentKey(match, file)
        result = `i18n.t('${currentKey}')`
        VueI18nInstance.setMessageItem(currentKey, match)
        return result
      } else {
        //对于 `` 拼接字符串的替换
        let matchIndex = 0
        let matchArr: string[] = []
        // Split the string into chunks of static text and expressions ${...}
        // This is necessary to handle nested braces {} inside expressions correctly
        let chunks: { type: 'text' | 'expr', value: string }[] = []
        let current = 0
        while (current < match.length) {
          let exprStart = match.indexOf('${', current)
          if (exprStart === -1) {
            chunks.push({ type: 'text', value: match.slice(current) })
            break
          } else {
            if (exprStart > current) {
              chunks.push({ type: 'text', value: match.slice(current, exprStart) })
            }
            // Find finding closing brace with balancing
            let braceCount = 1
            let i = exprStart + 2
            while (i < match.length && braceCount > 0) {
              if (match[i] === '{') braceCount++
              else if (match[i] === '}') braceCount--
              i++
            }
            if (braceCount === 0) {
              chunks.push({ type: 'expr', value: match.slice(exprStart, i) }) // includes ${ and }
              current = i
            } else {
              // Unbalanced or end of string, treat rest as text
              chunks.push({ type: 'text', value: match.slice(current) })
              break
            }
          }
        }

        // Check if there are Chinese characters in the static text parts
        const hasChineseInText = chunks.some(chunk => chunk.type === 'text' && /[\u4e00-\u9fa5]/.test(chunk.value))

        if (hasChineseInText) {
          const hasNewline = chunks.some(chunk => chunk.type === 'text' && (chunk.value.includes('\n') || chunk.value.includes('\\n')))

          if (hasNewline) {
            let resultParts = chunks.map(chunk => {
              if (chunk.type === 'text') {
                if (/[\u4e00-\u9fa5]/.test(chunk.value)) {
                  currentKey = VueI18nInstance.getCurrentKey(chunk.value, file)
                  VueI18nInstance.setMessageItem(currentKey, chunk.value)
                  return '${i18n.t(\'' + currentKey + '\')}'
                } else {
                  return chunk.value
                }
              } else {
                const exprContent = chunk.value.slice(2, -1)
                const processedExpr = replaceJavaScript(exprContent, file, VueI18nInstance, msg)
                return '${' + processedExpr + '}'
              }
            })
            return '`' + resultParts.join('') + '`'
          }

          // If the template string itself contains Chinese, treat the whole thing as one translation key using parameters
          let templateString = ''
          chunks.forEach(chunk => {
            if (chunk.type === 'text') {
              templateString += chunk.value
            } else {
              // Extract expression content: ${ expr } -> expr
              const exprContent = chunk.value.slice(2, -1)
              // Recursively process the expression for translations
              const processedExpr = replaceJavaScript(exprContent, file, VueI18nInstance, msg)
              matchArr.push(processedExpr)
              templateString += `{${matchIndex++}}`
            }
          })
          
          currentKey = VueI18nInstance.getCurrentKey(templateString, file)
          VueI18nInstance.setMessageItem(currentKey, templateString)
          
          if (!matchArr.length) {
            result = `i18n.t('${currentKey}')`
          } else {
            result = `i18n.t('${currentKey}', [${matchArr.toString()}])`
          }
           return result
        } else {
          // If no Chinese in static text, just reconstruct the string with potentially translated expressions
          // This preserves the template string structure (backticks) but translates inner parts
           let resultParts = chunks.map(chunk => {
            if (chunk.type === 'text') {
               return chunk.value
            } else {
               const exprContent = chunk.value.slice(2, -1)
               const processedExpr = replaceJavaScript(exprContent, file, VueI18nInstance, msg)
               return '${' + processedExpr + '}'
            }
          })
          // We need to be careful not to double-wrap if it was already part of a replacement logic,
          // but here we are returning the raw string suitable for being inside the file.
          // However, the regex matched the whole `...` string.
          // If we return just `...` it might be matched again? No, replace matching consumes it.
          // We must return the new source code string.
           return '`' + resultParts.join('') + '`'
        }
      }
    }
  )

  //换回注释部分
  content = content.replace(/\/\*comment_\d+\*\//gim, (match: string) => {
    return comments[match]
  })
  return content
}
