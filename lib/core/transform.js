"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.replaceVueTemplate = exports.replaceJavaScriptFile = exports.replaceVueScript = void 0;
var replaceJavaScript_1 = require("./replaceJavaScript");
var replaceVueTemplate_1 = require("./replaceVueTemplate");
exports.replaceVueTemplate = replaceVueTemplate_1.default;
var path = require('path');
var i18nMatchRegExp = /(import[\s\t]+i18n[\s\t]+from.+['"].+['"];?)|((let|var|const)[\s\t]+i18n[\s\t]+=[\s\t]+require\(['"].+['"]\)[\s\t]*;?)/m;
/**
 * 获取 i18n 导入路径
 * @param options 配置选项
 * @param file 文件路径
 * @returns i18n 导入路径
 */
function getI18nImportPath(options, file) {
    if (options.i18nImportPath) {
        // 使用配置的自定义导入路径
        return options.i18nImportPath;
    }
    else {
        // 使用相对路径计算
        var i18n = path
            .relative(path.dirname(file), path.join(options.projectDirname, options.outdir))
            .replace(/\\/g, '/');
        return i18n[0] === '.' ? i18n + '/index' : './' + i18n + '/index';
    }
}
/**
 * 替换 vue 中的 script
 * @param content 文本
 * @param file 文件路径
 * @returns
 */
function replaceVueScript(content, file, VueI18nInstance, msg) {
    return content.replace(/(<script[^>]*>)((?:.|\n|\r)*)(<\/script>)/gim, function (_, prev, match, next, offset, string) {
        var options = VueI18nInstance.getConfig();
        var i18nImportPath = getI18nImportPath(options, file);
        //判断是否已经引入了 i18n
        var i18nMatch = match.match(i18nMatchRegExp);
        if (i18nMatch) {
            // 如果已经存在导入，且配置了自定义路径，则替换旧的导入路径
            if (options.i18nImportPath) {
                match = match.replace(i18nMatchRegExp, function (matchStr) {
                    // 保持原有的格式（分号、换行等）
                    var hasSemicolon = matchStr.includes(';');
                    var hasNewline = matchStr.includes('\n');
                    var replacement = "import i18n from '".concat(i18nImportPath, "'");
                    if (hasSemicolon)
                        replacement += ';';
                    if (hasNewline)
                        replacement += '\n';
                    return replacement;
                });
            }
        }
        else {
            // 先进行替换，检查是否实际使用了 i18n
            var originalMatch = match;
            match = (0, replaceJavaScript_1.default)(match, file, VueI18nInstance, msg);
            // 判断是否需要导入 i18n
            // 检查 script 部分是否使用了 i18n.t(
            var hasI18nUsageInScript = /i18n\.t\(/.test(match);
            // 检查整个文件（包括 template）是否使用了 $t(
            var hasI18nUsageInTemplate = /\$t\(/.test(string);
            var forceImport = options.forceImportI18n !== false; // 默认为 true，保持向后兼容
            var hasI18nUsage = hasI18nUsageInScript;
            if (forceImport || hasI18nUsage) {
                // 若没有引入，则在文件头部引入
                prev = prev + "\nimport i18n from '".concat(i18nImportPath, "'\n");
            }
            else {
                // 如果没有使用 i18n，恢复原始内容
                match = originalMatch;
            }
        }
        return prev + match + next;
    });
}
exports.replaceVueScript = replaceVueScript;
/**
 * 替换js文件
 * @param content
 * @param file
 * @param VueI18nInstance
 * @param msg
 * @returns
 */
function replaceJavaScriptFile(content, file, VueI18nInstance, msg) {
    var options = VueI18nInstance.getConfig();
    var i18nImportPath = getI18nImportPath(options, file);
    //判断是否已经引入了 i18n
    var i18nMatch = content.match(i18nMatchRegExp);
    if (i18nMatch) {
        // 如果已经存在导入，且配置了自定义路径，则替换旧的导入路径
        if (options.i18nImportPath) {
            content = content.replace(i18nMatchRegExp, function (matchStr) {
                // 保持原有的格式（分号、换行等）
                var hasSemicolon = matchStr.includes(';');
                var hasNewline = matchStr.includes('\n');
                var replacement = "import i18n from '".concat(i18nImportPath, "'");
                if (hasSemicolon)
                    replacement += ';';
                if (hasNewline)
                    replacement += '\n';
                return replacement;
            });
        }
    }
    else {
        // 先进行替换，检查是否实际使用了 i18n
        var originalContent = content;
        content = (0, replaceJavaScript_1.default)(content, file, VueI18nInstance, msg);
        // 判断是否需要导入 i18n
        var forceImport = options.forceImportI18n !== false; // 默认为 true，保持向后兼容
        var hasI18nUsage = /i18n\.t\(/.test(content);
        if (forceImport || hasI18nUsage) {
            // 若没有引入，则在文件头部引入
            content = "import i18n from '".concat(i18nImportPath, "'\n").concat(content);
        }
        else {
            // 如果没有使用 i18n，恢复原始内容
            content = originalContent;
        }
    }
    return content;
}
exports.replaceJavaScriptFile = replaceJavaScriptFile;
