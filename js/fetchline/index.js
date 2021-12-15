var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i;
    function verb(n) { if (g[n]) i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
const escapeRegExp = (s) => s.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&');
const getChunkIteratorFetch = (filepath) => __awaiter(void 0, void 0, void 0, function* () {
    const res = yield fetch(filepath);
    if (res.body === null) {
        throw new Error('Cannot read file');
    }
    return res.body.getReader();
});
/**
 * Fetch and read remote text file line by line over HTTP(S) with modern browsers or Deno
 *
 * @param filepath - URL of the text file
 * @param options - options, including the following three
 * @param options.includeLastEmptyLine - Should it count the last empty line?
 * @param options.encoding - File encoding
 * @param options.delimiter - Line (or other item)'s delimiter / separator
 *
 * @returns An asynchronous iterable iterator containing each line in string from the text file
 */
export default function fetchline(filepath, { includeLastEmptyLine = true, encoding = 'utf-8', delimiter = /\r?\n/g, } = {}) {
    return __asyncGenerator(this, arguments, function* fetchline_1() {
        const reader = yield __await(getChunkIteratorFetch(filepath));
        let { value: chunk, done: readerDone } = yield __await(reader.read());
        const decoder = new TextDecoder(encoding);
        let chunkStr = chunk ? decoder.decode(chunk) : '';
        let re;
        if (typeof delimiter === 'string') {
            if (delimiter === '') {
                throw new Error('delimiter cannot be empty string!');
            }
            re = new RegExp(escapeRegExp(delimiter), 'g');
        }
        else if (/g/.test(delimiter.flags) === false) {
            re = new RegExp(delimiter.source, delimiter.flags + 'g');
        }
        else {
            re = delimiter;
        }
        let startIndex = 0;
        while (1) {
            const result = re.exec(chunkStr);
            if (result === null) {
                if (readerDone === true) {
                    break;
                }
                const remainder = chunkStr.substring(startIndex);
                ({ value: chunk, done: readerDone } = yield __await(reader.read()));
                chunkStr = remainder + (chunkStr ? decoder.decode(chunk) : '');
                startIndex = 0;
                continue;
            }
            yield yield __await(chunkStr.substring(startIndex, result.index));
            startIndex = re.lastIndex;
        }
        if (includeLastEmptyLine || startIndex < chunkStr.length) {
            yield yield __await(chunkStr.substring(startIndex));
        }
    });
}
