/* eslint-disable @typescript-eslint/naming-convention */
import type VueI18n from './i18nFile'
import replaceJavaScript from './replaceJavaScript'
import replaceVueTemplate from './replaceVueTemplate'
const path = require('path')

const i18nMatchRegExp =
  /(import[\s\t]+i18n[\s\t]+from.+['"].+['"];?)|((let|var|const)[\s\t]+i18n[\s\t]+=[\s\t]+require\(['"].+['"]\)[\s\t]*;?)/m

export type Message = {
  warn?: (message: string) => void
  error?: (message: string) => void
}

/**
 * 获取 i18n 导入路径
 * @param options 配置选项
 * @param file 文件路径
 * @returns i18n 导入路径
 */
function getI18nImportPath(options: any, file: string): string {
  if (options.i18nImportPath) {
    // 使用配置的自定义导入路径
    return options.i18nImportPath
  } else {
    // 使用相对路径计算
    const i18n = path
      .relative(path.dirname(file), path.join(options.projectDirname, options.outdir))
      .replace(/\\/g, '/')
    return i18n[0] === '.' ? i18n + '/index' : './' + i18n + '/index'
  }
}

/**
 * 替换 vue 中的 script
 * @param content 文本
 * @param file 文件路径
 * @returns
 */
export function replaceVueScript(
  content: string,
  file: string,
  VueI18nInstance: VueI18n,
  msg: Message
) {
  return content.replace(
    /(<script[^>]*>)((?:.|\n|\r)*)(<\/script>)/gim,
    (_: string, prev, match, next, offset, string) => {
      const options = VueI18nInstance.getConfig()
      const i18nImportPath = getI18nImportPath(options, file)
      
      //判断是否已经引入了 i18n
      let i18nMatch = match.match(i18nMatchRegExp)

      if (i18nMatch) {
        // 如果已经存在导入，且配置了自定义路径，则替换旧的导入路径
        if (options.i18nImportPath) {
          match = match.replace(
            i18nMatchRegExp,
            (matchStr: string) => {
              // 保持原有的格式（分号、换行等）
              const hasSemicolon = matchStr.includes(';')
              const hasNewline = matchStr.includes('\n')
              let replacement = `import i18n from '${i18nImportPath}'`
              if (hasSemicolon) replacement += ';'
              if (hasNewline) replacement += '\n'
              return replacement
            }
          )
        }
      } else {
        // 先进行替换，检查是否实际使用了 i18n
        const originalMatch = match
        match = replaceJavaScript(match, file, VueI18nInstance, msg)
        
        // 判断是否需要导入 i18n
        // 检查 script 部分是否使用了 i18n.t(
        const hasI18nUsageInScript = /i18n\.t\(/.test(match)
        // 检查整个文件（包括 template）是否使用了 $t(
        const hasI18nUsageInTemplate = /\$t\(/.test(string)
        
        const forceImport = options.forceImportI18n !== false // 默认为 true，保持向后兼容
        const hasI18nUsage = hasI18nUsageInScript
        
        if (forceImport || hasI18nUsage) {
          // 若没有引入，则在文件头部引入
          prev = prev + `\nimport i18n from '${i18nImportPath}'\n`
        } else {
          // 如果没有使用 i18n，恢复原始内容
          match = originalMatch
        }
      }

      return prev + match + next
    }
  )
}

/**
 * 替换js文件
 * @param content
 * @param file
 * @param VueI18nInstance
 * @param msg
 * @returns
 */
export function replaceJavaScriptFile(
  content: string,
  file: string,
  VueI18nInstance: VueI18n,
  msg: Message
) {
  const options = VueI18nInstance.getConfig()
  const i18nImportPath = getI18nImportPath(options, file)
  
  //判断是否已经引入了 i18n
  let i18nMatch = content.match(i18nMatchRegExp)

  if (i18nMatch) {
    // 如果已经存在导入，且配置了自定义路径，则替换旧的导入路径
    if (options.i18nImportPath) {
      content = content.replace(
        i18nMatchRegExp,
        (matchStr: string) => {
          // 保持原有的格式（分号、换行等）
          const hasSemicolon = matchStr.includes(';')
          const hasNewline = matchStr.includes('\n')
          let replacement = `import i18n from '${i18nImportPath}'`
          if (hasSemicolon) replacement += ';'
          if (hasNewline) replacement += '\n'
          return replacement
        }
      )
    }
  } else {
    // 先进行替换，检查是否实际使用了 i18n
    const originalContent = content
    content = replaceJavaScript(content, file, VueI18nInstance, msg)
    
    // 判断是否需要导入 i18n
    const forceImport = options.forceImportI18n !== false // 默认为 true，保持向后兼容
    const hasI18nUsage = /i18n\.t\(/.test(content)
    
    if (forceImport || hasI18nUsage) {
      // 若没有引入，则在文件头部引入
      content = `import i18n from '${i18nImportPath}'\n${content}`
    } else {
      // 如果没有使用 i18n，恢复原始内容
      content = originalContent
    }
  }
  return content
}

export { replaceVueTemplate }
