/**
 * Author: Enzo Aicardi
 * Release: @1.1
 * Date: 12/04/2022
 * Website: https://aicardi.pro
 * Documentation: https://smalldom.aicardi.pro
 */

var smallDomDebug = false;

// pass aditionnal arguments to main error functions
// like errAsConsoleLog or errAsHTML
var smallDomErrorArgs = [];

// smallDomReplace {function} (selector || 'small-dom')
// the function use smallDomTranspile to convert the source code, and in a second time
// use smallDomExporter to change the source outerHTML by the the code
function smallDomReplace(selector, options){
    
    // SOURCES
    selector = selector === 'all' ? 'small-dom' : selector;
    var sources = document.querySelectorAll(selector || 'small-dom');
    var transpiledCode = false;

    // for all small-dom element we transpile
    for(var x=0; x<sources.length; x++){

        try{

            var source = sources[x];
            var sourceCode = source.textContent;

            smallDomDebug = source.hasAttribute('debug') ? true : false;
            if(smallDomDebug){
                console.log('----- SOURCE ELEMENT HERE');
                console.log(source);
            }

            smallDomErrorArgs = [source, sourceCode];
            err = errAsHTML;

            transpiledCode = smallDomTranspile(sourceCode, options);
            smallDomExporter(transpiledCode);


        }catch(e){
            continue;
        }

    }

    function smallDomExporter(code){

        source.outerHTML = code;
        return document.body.innerHTML;

    }

    return document.body.innerHTML;

}


// smallDomTranspile {function} (code)
// convert a smallDom source code into HTML DOM tree
// by using {Tokeniser, Parser, Generator}
function smallDomTranspile(sourceCode, options){

    return  smallDomGenerator(
            smallDomParser(
            smallDomTokeniser(
                sourceCode
            )), options);

}


// TOKENISER
// smallDomTokeniser {function} (code)
// convert a smallDom source code into an array of tokens
// like STRING, NUMBER, ATTRIBUTE and return the array

function smallDomTokeniser(code){

    // OUTPUT -> TOKENS
    var tokens = [];
    var variables = {};

    var _startLine = 0;
    var _endLine = 0;
    var _startLineFirstChar = 0;
    var _endLineFirstChar = 0;
    var _startChar = 0;
    var _endChar = 0;
    var _startCol = 0;
    var _endCol = 0;

    // regex
    var BLANK = /\s/;
    var LETTER_NUMBER = /[\w\d]/;

    var LETTER = /\w/;
    var NUMBER = /\d/;

    /**
     * add function
     * @param {string} input value of the token
     * @param {string} type the type of the token
     * @param {string} key the key of the token who is a more precise type
     */

    function add(input, type, key){
        tokens.push({
            input: input,
            type: type,
            key: key || type || 'UNDEFINED',
            position: {
                start: {
                    char: _startChar,
                    line: _startLine,
                    col: _startCol,
                    lineFirstChar: _startLineFirstChar
                },
                end: {
                    char: _endChar,
                    line: _endLine,
                    col: _endCol,
                    lineFirstChar: _endLineFirstChar
                }
            }
        });
    }

    add(null, 'BORDER', 'START');

    for(var i=0; i < code.length; i++){

        // _startChar = i, representing the first character of the current token
        _startChar = i;
        // set c = current character
        var c = code[i];

        // default values for add() function
        // they must change for each DEFINED token
        var input = c;
        var type = 'UNDEFINED';
        var key = null;

        // inc represent the i recalculation at the end of token creation
        // sometimes you need to decrease i by 1 setting inc = (-1)
        // the reason of this is when you use a while loop the i incrementation
        // is doing after the condition verification, so when you pass in the
        // next for loop cycle, i will increase by 1 again, if you don't decrease
        // i by 1 you will miss 1 character after each token.
        // Sometimes, when you want to avoid the closure you don't need to decrease i
        var inc = 0;

        // string
        if(LETTER.test(c)) {
            type = 'KEYWORD'; key = 'ELEMENT'; inc = (-1);
            i++;
            // in every while we test if code[i] exist
            // if not it's because we are at the end of the code
            // so sometimes we want to get the string like this and end the tokenizer with new token
            // but sometimes we want to generate an error because of missing close symbol
            // in the second case we test !code[i] inside the while loop
            while(code[i] && (LETTER_NUMBER.test(code[i]) || code[i] === '-')){
                // for selfclosing elements we catch the next char,
                // if its a ! we change the key and set inc to 0 to
                // outpass ! in the next analysis
                if(code[i+1] === '!') {key = 'SELF_CLOSING_ELEMENT'; inc = 0;}
                if(code[i+1] === '(') {key = 'FUNCTION';}
                input += code[i];
                i++;
            }
        } 

        // number
        else if(NUMBER.test(c)) {
            type = 'NUMBER'; inc = (-1);
            i++;
            while(code[i] && NUMBER.test(code[i])){
                input += code[i];
                i++;
            }
        }

        // variable name
        else if(c === '$' && LETTER_NUMBER.test(code[i+1])) { 

            input = ''; type = 'VARIABLE'; key = 'DECLARATION';
            i++; inc = (-1);

            // here wet get the variable name
            while(code[i] && !BLANK.test(code[i])){
                if(!LETTER_NUMBER.test(code[i])) err(errMissingAfter('BLANK', type, key), getTrace());
                input += code[i];
                i++;
            }
            i++;

            // here we get the variable value
            // only inline syntax available to prevent node breaking
            var output = '';
            while(code[i] && code[i] !== '\n' && code[i] !== ';'){
                if(code[i] === '\\' && code[i+1] === ';') i++;
                output += code[i];
                i++;
            }

            if(code[i] === ';') i++;

            // set the variable
            variables[input] = output;
        }

        // variable value
        else if(c === '$' && code[i+1] === '{') {
            i = addVariable(i); continue;
        }

        // line break
        else if(c === '\n') { 
            type = 'BLANK'; key = 'BREAK';
            codebr();
        }

        // operators
        else if(c === '+' || c === '-' || c === '=') {
            type = 'OPERATOR';
            key = c === '+' ? 'LEVEL_UP' : c === '-' ? 'LEVEL_DOWN' : 'LEVEL_EQUAL';
        }

        // text
        else if(c === '"' || c === "{") {
            var closure = c === '"' ? c : "}";
            input = ''; type = 'TEXT';
            i++;

            while(code[i] !== closure){
                if(!code[i]) err(errMissingClose(type), getTrace());
                if(code[i] === '\n') br();
                // if the current char is an escape char
                // we increment i to get code[i] the next char (only if exist) and outpass the backslash
                if(code[i] === '$' && code[i+1] === '{') { addVariable(i); continue; }
                if(code[i] === '\\' && code[i+1]) i++;
                input += code[i];
                i++;
            }
        }

        // attributes
        else if(c === '[') {
            input = ''; type = 'ATTRIBUTE'; key = 'ATTRIBUTE_NAME';
            i++;
            while(code[i] !== ']'){
                if(!code[i] || BLANK.test(code[i])) err(errMissingClose(key), getTrace());
                if(code[i] === '$' && code[i+1] === '{') { addVariable(i); continue; }
                input += code[i];
                i++;
            }
        }

        // class
        else if(c === '.') {

            input = ''; type = 'ATTRIBUTE'; key = 'CLASS'; inc = (-1);
            i++;
            while(code[i] && !BLANK.test(code[i])){
                if(code[i] === '.'){
                    input += ' ';
                } else {
                    if(code[i] === '$' && code[i+1] === '{') { addVariable(i); continue; }
                    input += code[i];
                }
                i++;
            }

        }

        // values
        else if(c === '('){
            input = ''; type = 'VALUE'; key = 'VALUE';
            i++;
        
            while(code[i] !== ')'){
                if(!code[i]) err(errMissingClose(key), getTrace());
                if(code[i] === '$' && code[i+1] === '{') { addVariable(i); continue; }
                if(code[i] === '\\' && code[i+1]) i++;
                input += code[i];
                i++;
            }
        }

        // inline comments
        else if(c === '#'){
            input = ''; type = 'COMMENT'; key = 'COMMENT_INLINE'; inc = (-1);
            i++;
        
            while(code[i] && code[i] !== '\n'){
                input += code[i];
                i++;
            }
        }

        // space and tab
        else if(c === ' ') {
            if(code.substring(i, i+4) === '    ') {
                input = '    '; type = 'BLANK'; key = 'TAB'; inc = 3;
            }else{
                type = 'BLANK'; key = 'SPACE';
            }
        }
        else if(c === '\t') { 
            input = '    '; type = 'BLANK'; key = 'TAB';
        }

        // add variable
        function addVariable(begin){

            var name = ''; i+=2; var x = i;

            while(code[x] !== '}'){
                // special escape here, we just want to pass the escape character
                // without auto print the next character
                if(code[x] === '\\') { x++; continue; }
                if(!code[x] || !LETTER_NUMBER.test(code[x])) err(errMissingClose('VARIABLE SUMMON'), getTrace());
                name += code[x];
                x++;
            }

            var value = variables[name];
            

            // use the variable
            if(!value) err(errUndefined(name, 'VARIABLE'), getTrace());

            var code_start = code.slice(0, begin);
            var code_end = code.slice(x+1);

            code = code_start + value + code_end;
            input += value;
            // update error log sourceCode
            smallDomErrorArgs[1] = code;

            i += value.length - 2;
            return begin - 1;
            
        }

        // line break token position
        function codebr(){
            _endLine++;
            _startLineFirstChar = i+1;
            _endLineFirstChar = i+1;
        }

        function br(){
            _endLine++;
            _endLineFirstChar = i+1;
        }

        // token position update
        function tokenPositionUpdate(){
            i += inc;
            _endChar = i;
            _startCol = _startChar - _startLineFirstChar;
            _endCol = _endChar - _endLineFirstChar;
        }

        function getTrace(){
            tokenPositionUpdate();
            return {
                start: {
                    line: _startLine,
                    char: _startChar,
                    col: _startCol
                },
                end: {
                    line: _endLine,
                    char: _endChar,
                    col: _endCol
                }
            };
        }

        tokenPositionUpdate();
        add(input, type, key);

        // update startLine to correspond to the final line
        _startLine = _endLine;

    }

    add(null, 'BORDER', 'END');

    if(smallDomDebug){
        console.log('----- TOKEN LIST HERE');
        console.log(tokens);
    }
    return tokens;

}

// PARSER
// smallDomParser {function} (tokens)
// convert an array of tokens into an AST and return the AST

function smallDomParser(tokens){

    // OUTPUT -> AST
    // AST main element, also the first node we analyse
    var ast = {
        nodeName: "body",
        nodeType: "BODY",
        nodeValue: "",
        level: 0,
        br: 0,
        childs: [],
        attributes: [],
        position: {}
    };

    // level (compared to node.level)
    // default = 1 (only body get 0)
    // in case of positionning errors put var level = 1 inside analyse() function
    var level = 1;
    // br correpond to the number of line breaks in the sdom code before the node
    var br = 0;

    // conditions
    var isLineIndent = true;

    // analyse function to analyse the AST, node by node
    // it's also her callback function, it's necessary to keep the [node] callStack
    function analyse(node, startValue){

        var childs = node.childs || ast.childs;
        var i = startValue || 0;

        /**
         * addNode function
         * @param {object} token the current token
         * @param {number} level the current line level
         * @param {string} type 'TEXT' || 'ELEMENT'
         * @returns newNode reference inside node.childs
         */

        function addNode(token, level, type, value){
            var newNode = {
                nodeToken: token,
                nodeName: token.input,
                nodeType: type || 'ELEMENT',
                nodeValue: value || token.input,
                level: level,
                br: br,
                childs: [],
                attributes: []
            }
            br = 0;
            childs.push(newNode);
            return newNode;
        }

        // token exploration
        for(i = startValue; i < tokens.length; i++){

            var tk = tokens;
            var t = tokens[i];

            if(t.type !== 'BLANK' && t.type !== 'BORDER'){
                isLineIndent = false;
            }

            if(t.type === 'OPERATOR'){
                if(t.key === 'LEVEL_UP'){
                    level++;
                }
                if(t.key === 'LEVEL_DOWN'){
                    level--;
                }
                continue;
            }

            if(t.type === 'KEYWORD'){

                // if the newNode.level (var level) is lower than node.level it correspond
                // to a new block, so we return function to comme back to the parent node
                // return level to add it to the newNode on parent analyse()
                if(node.level >= level) {
                    return toParent();
                }

                // if the node is a function, we outpass the analyse callback
                // but the level is keeped, for that reason, a function node is also a node breaker
                if(t.key === 'FUNCTION'){
                    // we print the arguments inside nodeValue
                    if(tk[i+1].key === 'VALUE'){
                        var value = tk[i+1].input;
                        addNode(t, level, t.key, value);
                    }
                    continue;
                }

                // create newNode and analyse next tokens until level is same or higher
                var newNode = addNode(t, level);
                var res = analyse(newNode, i+1);

                // set new i and level values from the last childNode
                // necessary because the transimisson to parent operate with return
                // and the transmission to child operate with function param startValue

                i = res.i;
                level = res.level;

                continue;

            }

            if(t.type === 'ATTRIBUTE'){

                // else if we are inside a node without line br we can add attribute
                if(t.key === 'CLASS'){
                    node.attributes.push({name: "class", value: t.input});
                    continue;
                }

                if(t.key === 'ATTRIBUTE_NAME'){
                    var value = '';

                    if(tk[i+1].key === 'VALUE'){
                        value = tk[i+1].input;
                    }

                    node.attributes.push({name: t.input, value: value});
                    continue;
                }

            }

            if(t.type === 'TEXT'){

                // if text is under the node we suppose that he is a direct parent child
                if(node.level > level) {
                    return toParent();
                }

                addNode(t, level, t.type);
                continue;

            }

            if(t.type === 'BLANK'){

                if(t.key === 'BREAK'){
                    br++;
                    level = 1;
                    isLineIndent = true;
                    continue;
                }

                // increment level on each SPACE and TAB
                // only when isLineIndent, corresponding to true
                if(!isLineIndent) continue;
                if(t.key === 'SPACE'){
                    level++;
                    continue;
                }
                if(t.key === 'TAB'){
                    level+=4;
                    continue;
                }

            }

        }

        function toParent(){
            isLineIndent = true;
            return {level: level, i: i-1};
        }

        return {level: level, i: i};

    }

    analyse(ast, 0);

    if(smallDomDebug){
        console.log('----- NODE TREE HERE');
        console.log(ast);
    }
    return ast;

}

// GENERATOR
// smallDomGenerator {function} (ast)
// convert an AST into an HTML DOM tree and return the HTML as string

function smallDomGenerator(ast, options){

    // OUTPUT -> HTML
    var HTML = '';

    // inline, wrap, format, pre
    // - inline: render HTML as one line without spaces and line breaks
    // - pre: render HTML with same breaks and spaces
    // - wrap: render HTML with regular breaks and spaces
    // - pre-wrap: render HTML with regular breaks and spaces if there is a minimum of one
    options = options || {}
    var mode = options.mode || 'inline';
    var breaks = options.breaks || 1;
    var templates = {};

    function explore(node){
        
        var childs = node.childs;

        for(var i=0; i<childs.length; i++){

            var child = childs[i];

            if(child.nodeType === 'TEXT'){

                var breaks = getBreaks(child);
                HTML += breaks + (breaks ? getSpaces(child) : '') + escapeHTML(child.nodeValue);
                continue;

            }

            if(child.nodeType === 'ELEMENT'){

                // for every ELEMENT child, we open the tag, set attributes
                openTag(child);
                // next we explore his proper childs before closing
                explore(child);
                // when it's done we close the tag
                closeTag(child);
                continue;

            }

            if(child.nodeType === 'FUNCTION'){

                if(child.nodeName === 'break') continue;

                var args = child.nodeValue.replace(/ ?, ?/g, ',').split(',');
                var pos = child.nodeToken.position;

                // this function clone a certain number of brother element
                if(child.nodeName === 'clone'){
                    var num = numArg(args[0]);
                    var els = numArg(args[1]) || 1;

                    var array = [];

                    for(var u=0; u<num; u++){
                        for(var j=0; j<els; j++){
                            array.push(childs[i+j+1]);
                        }
                    }

                    childs.splice(i+1, 0, ...array);
                    continue;
                }

                // this function create a template with a name
                if(child.nodeName === 'template'){
                    if(!childs[i+1]) missElement();
                    templates[child.nodeValue] = childs[i+1];
                    continue;
                }

                // this function include a template by his name
                if(child.nodeName === 'include'){
                    var value = child.nodeValue, template = templates[value];

                    if(!template) err(errUndefined(value, 'TEMPLATE'), pos);
                    if(mode !== 'inline' || smallDomDebug) updateLevel(template, template.level, child);
                    childs.splice(i+1, 0, template);
    
                    continue;
                }

                function missElement(){
                    err(errMissingAfter('ELEMENT', child.nodeType, child.nodeName), pos);
                }

                // the default error if the function doesn't exist
                err(errUndefined(child.nodeName, child.nodeType), pos);
            }

        }

        return HTML;

    }

    // Node functions
    function openTag(node, close){

        // spaces based on node.level
        var spaces = getSpaces(node);
        var breaks = getBreaks(node);

        var attributes = '';
        if(!close){
            for(attr of node.attributes){
                attributes += ' ' + attr.name + (attr.value ? ('="' + escapeHTML(attr.value) + '"') : '');
            }
        }

        var self = node.nodeToken.key === 'SELF_CLOSING_ELEMENT';
        var tag = '';

        // if node is not a self closing element
        // or if it's not a closure tag
        if(!close || !self){

            var childBreaks = node.childs.length ? getBreaks(node.childs[0]) : '';

                    // if (open) -> we get the [line breaks] before the element and print it
                    // if (close) -> we get [line breaks] before the first children and print it before the end of the element
            tag += (close && (mode === 'pre' || mode === 'pre-wrap') ? childBreaks : breaks) + 

                    // if (open/close) -> if there is no break before the first children we don't print space
                   (mode !== 'wrap' && (!breaks || (close && !childBreaks)) ? '' : spaces) + 

                   // if (open) -> we print the element tag and attributes
                   // if (close) -> we print the closing element tag without attributes
                   // if (self) -> we print the end slash
                   '<' + (close ? '/' : '') + node.nodeName + attributes + (self ? ' /' : '') + '>';

        }

        HTML += tag;
    }

    function closeTag(node){ 
        openTag(node, true);
    }

    // we get spaces only if mode is not inline
    function getSpaces(node){
        var spaces = '';

        if(mode !== 'inline'){
            spaces = ' '.repeat(node.level-1);
        }

        return spaces;
    }

    // we get spaces only if mode is not inline
    function getBreaks(node){
        var br = '';

        if(mode === 'pre'){
            br = '\n'.repeat(node.br);
        }
        else if(mode === 'wrap'){
            br = '\n'.repeat(breaks);
        }
        else if(mode === 'pre-wrap' && node.br){
            br = '\n'.repeat(breaks);
        }

        return br;
    }

    // these are functions used inside generator nodeType === FUNCTION
    function numArg(str){
        if(!str || !/^[0-9]*$/.test(str)) return 0;
        return Number(str) || 0;
    }

    function updateLevel(node, oldParentLevel, newParent){
        node.level = node.level - oldParentLevel + newParent.level;

        if(node.nodeName === 'include'
        && node.nodeValue === newParent.nodeValue) {
            err(errValue(node.nodeValue, node.nodeName), node.nodeToken.position);
        }

        if(node.nodeType !== 'ELEMENT') return;

        for(var child of node.childs){
            updateLevel(child, oldParentLevel, newParent);
        }
    }

    explore(ast);

    if(smallDomDebug){
        console.log('----- HTML GENERATED HERE');
        console.log(HTML);
    }
    return HTML;

}

function escapeHTML(htmlStr) {
            
    return htmlStr.replace(/&/g, "&amp;")
                  .replace(/</g, "&lt;")
                  .replace(/>/g, "&gt;")
                  .replace(/"/g, "&quot;")
                  .replace(/'/g, "&#39;");

}

// COPY
// copy all the document to the clipboard
function domCopy(selector){
    var ignore = document.querySelectorAll('[data-smalldom]');
    for(element of ignore){
        element.remove();
    }

    var HTML = selector ? document.querySelector(selector).outerHTML : ('<!DOCTYPE html>' + document.documentElement.outerHTML);
    navigator.clipboard.writeText(HTML).then(function(){
        console.log('DOM successfully copied !');
    });
}

// err... {functions} (... args)
// this section correspond to all the error related functions

function errMissingClose(key){
    return 'Missing '+key+' close symbol.';
}
function errMissingBefore(missing, type, key){
    return missing + ' is missing before ' + type + ' ' + (key ? key : '');
}
function errMissingAfter(missing, type, key){
    return missing + ' is missing after ' + type + ' ' + (key ? key : '');
}
function errUndefined(name, type){
    return name + ' is not a defined ' + type;
}
function errValue(value, type){
    return value + ' is not a correct value of ' + type;
}

// The main error function, the only one used in code
// can be modified as err = errAsHTML for exemple to render an error as HTML block
// don't forget to update the smallDomErrorArgs variable to send additionnal args

/**
 * err {function} (msg, trace, type)
 * err... {child, functions} (msg, trace, type)
 * @param {string} msg the current message provided by the error
 * @param {object{start, end}} trace the current stack trace provided by tokeniser
 * @param {string} type the error type (like SyntaxError) to display in message
 */

var err = function(msg, trace, type){
    smallDomErrorArgs = [];
}

// default err referer function
err = errAsConsoleLog;

function errAsConsoleLog(msg, trace, type){

    // OUTPUT -> newErrMsg
    
    type = type || 'SyntaxError';
    
    var traceFormat = '';
    // only if the user give the file URL as : var smallDomErrURL = URL
    if(typeof smallDomErrURL !== 'undefined'){ traceFormat = '\n' + smallDomErrURL + ':' + trace.start.line + ':' + trace.start.col; }    
    
    var newErrMsg = 
        type + ': \n\n' + 
        msg + 
        '\n\nStart at - Line: ' + trace.start.line + ' | Column: ' + trace.start.col + 
        '\n  End at - Line: ' + trace.end.line + ' | Column: ' + trace.end.col + '\n' +
        traceFormat;

    console.error(newErrMsg);
    throw 'smallDom ERROR';

}

// Take the current code who generate the error and convert it
// to HTML error block
function errAsHTML(msg, trace, type){

    type = type || 'SyntaxError';
    // OUTPUT -> newErrCode

    var source = smallDomErrorArgs[0], sourceCode = smallDomErrorArgs[1];
    var smallDomCss = ' small-dom{ display: flex; flex-direction: column; font-family: Arial, Verdana, sans-serif; gap: 20px; width: 100%; min-width: 500px; height: min-content; padding: 20px; box-sizing: border-box; border-radius: 5px; background-color: white; box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.2); } small-dom *{ box-sizing: border-box; } small-dom-title{ display: flex; align-items: center; justify-content: center; width: max-content; height: 40px; padding: 0 20px; background-color: hsl(40, 90%, 65%); border-radius: 5px; color: white; font-weight: normal; font-size: 16px; } small-dom-code{ padding: 20px 0; box-sizing: border-box; background-color: hsl(40, 10%, 10%); border-radius: 5px; font-family: monospace; font-size: 14px; overflow: auto; } small-dom-code table{ width: 100%; border: none; border-collapse: collapse; table-layout: fixed; } small-dom-code table tr{ cursor: pointer; background-color: inherit; } small-dom-code table tr:nth-child(odd){ background-color: hsl(40, 10%, 15%); } small-dom-code table tr:hover{ background-color: hsl(215, 90%, 50%); } small-dom-code table tr td{ height: 20px; max-width: max-content; white-space: pre; color: white; padding: 2px 10px; } small-dom-code table tr td:first-child{ width: 40px; text-align: right; color: hsl(40, 90%, 65%); border-right: 1px solid #cccccc; } small-dom-error{ display: inline; padding: 1px 2px; margin: 0 2px; border-radius: 2px; background-color: hsl(40, 90%, 45%); } small-dom-banner{ width: 100%; max-width: max-content; height: auto; padding: 0 2px; background-color: white; color: hsl(40, 10%, 15%); font-size: 14px; font-family: monospace; } small-dom-orange{ color: hsl(40, 90%, 65%); } ';

    /* ADD STYLESHEET */

    var css = smallDomCss,
    head = document.head,
    style = document.createElement('style');

    style.textContent = css;
    head.appendChild(style);

    /* TITLE */

        // create the newErrCode variable
        // add the <small-dom-title></small-dom-title>
        var newErrCode = '<small-dom-title>'+type+'</small-dom-title>';
        
    /* CODE and ERROR */

        // secate in 3 parts (A = start, B = error, C = end)
        // add <small-dom-error></small-dom-error> arround the error chars
        var errCode = sourceCode;
        var partA = errCode.substring(0, trace.start.char);
        var partB = errCode.substring(trace.start.char, trace.end.char+1);
        var partC = errCode.substring(trace.end.char+1, errCode.length);

        // update errCode
        errCode = partA + '<small-dom-error>' + partB + '</small-dom-error>' + partC;
        
        // split errCode into an array of lines
        // convert this array to table with tr td for each line
        errCode = getTable(errCode);
        function getTable(code){
            var array = code.split('\n'), output = '<table>';
            for(var i=0; i<array.length; i++){
                output += '<tr><td>'+i+'</td><td>'+array[i]+'</td></tr>\n';
            }
            return output + '</table>';
        }

        newErrCode += '<small-dom-code class="ns">' 
                + errCode
                + '</small-dom-code>';

    /* BANNER */

        // push <small-dom-banner></small-dom-banner> at the end of small-dom
        var errMsg = type + ': ';
        errMsg += msg || 'no details';

        newErrCode += '<small-dom-banner>'+errMsg+'</small-dom-banner>'

    /* UPDATE */

        source.innerHTML = newErrCode;
        throw 'smallDom ERROR';

}