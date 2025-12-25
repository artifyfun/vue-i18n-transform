import replaceJavaScript from '../src/core/replaceJavaScript';
import VueI18n from '../src/core/i18nFile'
import _const from '../src/core/const'

const message = {
  error: () => { },
  warn: () => { }
}

describe('replaceJavaScript Template Literal Issue', () => {
  const config = {
      entry: 'testExample/origin',
      output: 'testExample/result',
      exclude: ['testExample/result'],
      locales: ['zh-CN', 'en-US'],
  }
  let VueI18nInstance: VueI18n
  beforeEach(() => {
    VueI18nInstance = new VueI18n()
    VueI18nInstance.mergeConfig({ ...config, projectDirname: process.cwd() })
  })

  it('Newlines in template literal should split translations', () => {
    const content = 'const str = `中文名: ${item.title}\\n英文名: ${item.code}`'
    const result = replaceJavaScript(
      content,
      'testExample/origin/test.js',
      VueI18nInstance,
      message
    )
    // Expectation: Split into multiple replacements preserving the structure
    // The punctuation/newlines inside text chunks are included in the key
    expect(result).toBe(
      "const str = `${i18n.t('test_1')}${item.title}${i18n.t('test_2')}${item.code}`"
    )
    
    // Verify keys
    const messages = VueI18nInstance.getMessage()
    expect(messages['test_1']).toBe('中文名: ')
    expect(messages['test_2']).toBe('\\n英文名: ')
  })

  it('No newlines in template literal should keep aggregated translation', () => {
     const content = 'const str = `中文名: ${item.title} 英文名: ${item.code}`' // No newline
     const result = replaceJavaScript(
      content,
      'testExample/origin/test.js',
      VueI18nInstance,
      message
    )
    // Should stay as one big key
    // matchArr.toString() produces no spaces after comma
    expect(result).toContain("i18n.t('test_1', [item.title,item.code])")
    expect(VueI18nInstance.getMessage()['test_1']).toBe('中文名: {0} 英文名: {1}')
  })
})
