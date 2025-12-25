import { replaceVueScript } from '../src/core/transform';
import VueI18n from '../src/core/i18nFile'

const message = {
  error: () => { },
  warn: () => { }
}

describe('forceImportI18n issue reproduction', () => {
  let VueI18nInstance: VueI18n
  
  beforeEach(() => {
    VueI18nInstance = new VueI18n()
    VueI18nInstance.mergeConfig({
      entry: 'src',
      outdir: 'src/locales',
      projectDirname: process.cwd(),
      forceImportI18n: false
    })
  })

  it('should NOT import i18n if forceImportI18n is false and script has no usage, even if template utilizes $t', () => {
    // Template uses $t, but script does not use i18n and has no Chinese to replace.
    const content = `
<template>
  <div>{{ $t('hello') }}</div>
</template>
<script>
export default {
  name: 'Test'
}
</script>`

    const result = replaceVueScript(
      content,
      '/path/to/src/test.vue',
      VueI18nInstance,
      message
    )

    // Should NOT contain import i18n
    expect(result).not.toContain("import i18n from")
  })
})
