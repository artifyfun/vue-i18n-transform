"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// (?!\1) 指 非 ['"`]
var jsChineseRegExp = /(['"`])(((?!\1).)*[\u4e00-\u9fa5]+((?!\1).)*)\1/gim;
function replaceJavaScript(content, file, VueI18nInstance, msg) {
    //替换注释部分
    var comments = {};
    var commentsIndex = 0;
    content = content.replace(
    // /(\/\*([^\*\/]*|.|\n|\r)*\*\/)|(\/\/.*)/gim,
    /(\/\*(?:(?!\*\/).|[\n\r])*\*\/)|(\/\/.*)/gim, function (match, _p1, _p2, offset, str) {
        //排除掉url协议部分,貌似不排除也不影响
        if (offset > 0 && str[offset - 1] === ':') {
            return match;
        }
        var commentsKey = "/*comment_".concat(commentsIndex++, "*/");
        comments[commentsKey] = match;
        return commentsKey;
    });
    // 替换掉原本就有的i18n.t('****')
    content = content.replace(/i18n\.t\(((?!\)).)*\)/gim, function (match) {
        var commentsKey = "/*comment_".concat(commentsIndex++, "*/");
        comments[commentsKey] = match;
        return commentsKey;
    });
    // 替换掉console.log()
    content = content.replace(/console\.log\([^\)]+\)/gim, function (match) {
        var commentsKey = "/*comment_".concat(commentsIndex++, "*/");
        comments[commentsKey] = match;
        return commentsKey;
    });
    // map里的中文键值不应该被替换
    // 所以先替换含有中文键值,后面再换回来，作用和注释一样，共用一个 comments
    content = content.replace(/['"][^'"]*[\u4e00-\u9fa5]+[^'"]*['"]\s*:/gim, function (match) {
        var commentsKey = "/*comment_".concat(commentsIndex++, "*/");
        comments[commentsKey] = match;
        return commentsKey;
    });
    // 替换（可能含有中文的 require）, 作用和注释一样，共用一个 comments
    content = content.replace(/require\(((?!\)).)*\)/gim, function (match) {
        var commentsKey = "/*comment_".concat(commentsIndex++, "*/");
        comments[commentsKey] = match;
        return commentsKey;
    });
    content = content.replace(jsChineseRegExp, function (_, prev, match, __, ___, offset) {
        match = match.trim();
        var currentKey;
        var result = '';
        if (prev !== '`') {
            //对于普通字符串的替换
            currentKey = VueI18nInstance.getCurrentKey(match, file);
            result = "i18n.t('".concat(currentKey, "')");
            VueI18nInstance.setMessageItem(currentKey, match);
            return result;
        }
        else {
            //对于 `` 拼接字符串的替换
            var matchIndex_1 = 0;
            var matchArr_1 = [];
            // Split the string into chunks of static text and expressions ${...}
            // This is necessary to handle nested braces {} inside expressions correctly
            var chunks = [];
            var current = 0;
            while (current < match.length) {
                var exprStart = match.indexOf('${', current);
                if (exprStart === -1) {
                    chunks.push({ type: 'text', value: match.slice(current) });
                    break;
                }
                else {
                    if (exprStart > current) {
                        chunks.push({ type: 'text', value: match.slice(current, exprStart) });
                    }
                    // Find finding closing brace with balancing
                    var braceCount = 1;
                    var i = exprStart + 2;
                    while (i < match.length && braceCount > 0) {
                        if (match[i] === '{')
                            braceCount++;
                        else if (match[i] === '}')
                            braceCount--;
                        i++;
                    }
                    if (braceCount === 0) {
                        chunks.push({ type: 'expr', value: match.slice(exprStart, i) }); // includes ${ and }
                        current = i;
                    }
                    else {
                        // Unbalanced or end of string, treat rest as text
                        chunks.push({ type: 'text', value: match.slice(current) });
                        break;
                    }
                }
            }
            // Check if there are Chinese characters in the static text parts
            var hasChineseInText = chunks.some(function (chunk) { return chunk.type === 'text' && /[\u4e00-\u9fa5]/.test(chunk.value); });
            if (hasChineseInText) {
                var hasNewline = chunks.some(function (chunk) { return chunk.type === 'text' && (chunk.value.includes('\n') || chunk.value.includes('\\n')); });
                if (hasNewline) {
                    var resultParts = chunks.map(function (chunk) {
                        if (chunk.type === 'text') {
                            if (/[\u4e00-\u9fa5]/.test(chunk.value)) {
                                currentKey = VueI18nInstance.getCurrentKey(chunk.value, file);
                                VueI18nInstance.setMessageItem(currentKey, chunk.value);
                                return '${i18n.t(\'' + currentKey + '\')}';
                            }
                            else {
                                return chunk.value;
                            }
                        }
                        else {
                            var exprContent = chunk.value.slice(2, -1);
                            var processedExpr = replaceJavaScript(exprContent, file, VueI18nInstance, msg);
                            return '${' + processedExpr + '}';
                        }
                    });
                    return '`' + resultParts.join('') + '`';
                }
                // If the template string itself contains Chinese, treat the whole thing as one translation key using parameters
                var templateString_1 = '';
                chunks.forEach(function (chunk) {
                    if (chunk.type === 'text') {
                        templateString_1 += chunk.value;
                    }
                    else {
                        // Extract expression content: ${ expr } -> expr
                        var exprContent = chunk.value.slice(2, -1);
                        // Recursively process the expression for translations
                        var processedExpr = replaceJavaScript(exprContent, file, VueI18nInstance, msg);
                        matchArr_1.push(processedExpr);
                        templateString_1 += "{".concat(matchIndex_1++, "}");
                    }
                });
                currentKey = VueI18nInstance.getCurrentKey(templateString_1, file);
                VueI18nInstance.setMessageItem(currentKey, templateString_1);
                if (!matchArr_1.length) {
                    result = "i18n.t('".concat(currentKey, "')");
                }
                else {
                    result = "i18n.t('".concat(currentKey, "', [").concat(matchArr_1.toString(), "])");
                }
                return result;
            }
            else {
                // If no Chinese in static text, just reconstruct the string with potentially translated expressions
                // This preserves the template string structure (backticks) but translates inner parts
                var resultParts = chunks.map(function (chunk) {
                    if (chunk.type === 'text') {
                        return chunk.value;
                    }
                    else {
                        var exprContent = chunk.value.slice(2, -1);
                        var processedExpr = replaceJavaScript(exprContent, file, VueI18nInstance, msg);
                        return '${' + processedExpr + '}';
                    }
                });
                // We need to be careful not to double-wrap if it was already part of a replacement logic,
                // but here we are returning the raw string suitable for being inside the file.
                // However, the regex matched the whole `...` string.
                // If we return just `...` it might be matched again? No, replace matching consumes it.
                // We must return the new source code string.
                return '`' + resultParts.join('') + '`';
            }
        }
    });
    //换回注释部分
    content = content.replace(/\/\*comment_\d+\*\//gim, function (match) {
        return comments[match];
    });
    return content;
}
exports.default = replaceJavaScript;
