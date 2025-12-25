"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 单纯替换tag content 中文文本并设置值
 * @param match
 * @param file
 * @param VueI18nInstance
 * @returns
 */
function replaceCNText(match, file, VueI18nInstance) {
    var currentKey = VueI18nInstance.getCurrentKey(match, file);
    VueI18nInstance.setMessageItem(currentKey, match);
    return "{{$t('".concat(currentKey, "')}}");
}
/**
 * 替换 vue 中的 template
 * @param content 文本
 * @param file 文件路径
 * @returns
 */
function replaceVueTemplate(content, file, VueI18nInstance, msg) {
    return content.replace(/<template(.|\n|\r)*template>/gim, function (match) {
        // 替换注释部分
        // 为何要替换呢？就是注释里可能也存在着 '中文' "中文" `中文` 等情况
        // 所以要先替换了之后再换回来
        var comments = {};
        var commentsIndex = 0;
        match = match.replace(/<!--(?:(?!-->).|[\n\r])*-->/gim, function (match, offset, str) {
            // offset 为偏移量
            // 排除掉url协议部分
            if (offset > 0 && str[offset - 1] === ':') {
                return match;
            }
            var commentsKey = "/*comment_".concat(commentsIndex++, "*/");
            comments[commentsKey] = match;
            return commentsKey;
        });
        // 替换(可能含有中文的） require, 作用和注释一样，共用一个 comments
        match = match.replace(/require\(((?!\)).)*\)/gim, function (match) {
            var commentsKey = "/*comment_".concat(commentsIndex++, "*/");
            comments[commentsKey] = match;
            return commentsKey;
        });
        // 替换掉原本就有的$t('****')
        match = match.replace(/\$t\(((?!\)).)*\)/gim, function (match) {
            var commentsKey = "/*comment_".concat(commentsIndex++, "*/");
            comments[commentsKey] = match;
            return commentsKey;
        });
        // 处理模板字符串（反引号包裹的内容），如 :label="`输入${item.label}`"
        // 将模板字符串转换为 $t() 调用，类似 JavaScript 的处理方式
        match = match.replace(/(:?(\w+-){0,}\w+=)(["'])(`[^`]*`)\3/gim, function (fullMatch, attrPrefix, _innerGroup, quote, templateStr) {
            // 检查模板字符串中是否包含中文
            if (!/[\u4e00-\u9fa5]/.test(templateStr)) {
                return fullMatch;
            }
            // 提取模板字符串中的变量 ${...}
            var matchIndex = 0;
            var matchArr = [];
            var templateContent = templateStr.slice(1, -1); // 去掉反引号
            var processedContent = templateContent.replace(/\${([^}]+)}/gim, function (_, varExpr) {
                matchArr.push(varExpr.trim());
                return "{".concat(matchIndex++, "}");
            });
            // 获取 key
            var currentKey = VueI18nInstance.getCurrentKey(processedContent, file);
            VueI18nInstance.setMessageItem(currentKey, processedContent);
            // 构建替换后的结果，保持原有的引号类型
            if (matchArr.length === 0) {
                // 没有变量，直接替换为 $t()
                return "".concat(attrPrefix).concat(quote, "$t('").concat(currentKey, "')").concat(quote);
            }
            else {
                // 有变量，使用 $t('key', [vars]) 形式
                return "".concat(attrPrefix).concat(quote, "$t('").concat(currentKey, "', [").concat(matchArr.toString(), "])").concat(quote);
            }
        });
        match = match.replace(/((\w+-){0,}\w+=['"]|>|'|")([^'"<>]*[\u4e00-\u9fa5]+[^'"<>]*)(['"<])/gim, function (_, prev, __, match, after, offset) {
            // 针对一些资源中含有中文名时，不做替换
            if (prev.match(/src=['"]/)) {
                return _;
            }
            match = match.trim();
            var result = '';
            var currentKey;
            if (match.match(/{{[^{}]+}}/)) {
                // 包含变量的中文字符串
                var matchIndex_1 = 0;
                var matchArr_1 = [];
                match = match.replace(/{{([^{}]+)}}/gim, function (_, match) {
                    matchArr_1.push(match);
                    return "{".concat(matchIndex_1++, "}");
                });
                currentKey = VueI18nInstance.getCurrentKey(match, file);
                if (!matchArr_1.length) {
                    // 普通替换，不存在变量
                    result = "".concat(prev, "{{$t('").concat(currentKey, "')}}").concat(after);
                }
                else {
                    // 替换成着中国形式 $t('name', [name]])
                    result = "".concat(prev, "{{$t('").concat(currentKey, "', [").concat(matchArr_1.toString(), "])}}").concat(after);
                }
            }
            else {
                if (match.match(/\/\*comment_\d+\*\//)) {
                    match = match.replace(/[\u4e00-\u9fa5]+/gim, function (m) {
                        return replaceCNText(m, file, VueI18nInstance);
                    });
                    result = prev + match + after;
                }
                else {
                    currentKey = VueI18nInstance.getCurrentKey(match, file);
                    if (prev.match(/^(\w+-){0,}\w+='$/)) {
                        //对于属性中普通文本的替换，不合理的单引号包裹属性值
                        result = ":".concat(prev, "$t(\"").concat(currentKey, "\")").concat(after);
                    }
                    else if (prev.match(/^(\w+-){0,}\w+="$/)) {
                        //对于属性中普通文本的替换
                        result = ":".concat(prev, "$t('").concat(currentKey, "')").concat(after);
                    }
                    else if ((prev === '"' && after === '"') || (prev === "'" && after === "'")) {
                        //对于属性中参数形式中的替换
                        result = "$t(".concat(prev).concat(currentKey).concat(after, ")");
                    }
                    else if (prev === '>' && after === '<') {
                        //对于tag标签中的普通文本替换
                        result = "".concat(prev, "{{$t('").concat(currentKey, "')}}").concat(after);
                    }
                    else {
                        // 无法处理，还原 result
                        result = prev + match + after;
                        (msg === null || msg === void 0 ? void 0 : msg.warn) && msg.warn("".concat(file, " \u5B58\u5728\u65E0\u6CD5\u81EA\u52A8\u66FF\u6362\u7684\u6587\u672C\uFF08").concat(result, "\uFF09\uFF0C\u8BF7\u624B\u52A8\u5904\u7406"));
                    }
                }
            }
            if (result !== prev + match + after && currentKey) {
                // result有变动的话，设置message
                VueI18nInstance.setMessageItem(currentKey, match);
            }
            return result;
        });
        // 换回注释 和 require
        return match.replace(/\/\*comment_\d+\*\//gim, function (match) {
            return comments[match];
        });
    });
}
exports.default = replaceVueTemplate;
