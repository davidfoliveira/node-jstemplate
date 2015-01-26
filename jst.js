"use strict";

/*
 * JST/JSTemplate - Javascript Templating
 *
 * Basic templating system for Javascript
 *
 * Version: 0.2.0
 * Author:  David Oliveira <d.oliveira@prozone.org>
 */

/*
  TODO:
    - Keep the track of templating dependences for checking stat times
 */

var
	fs				= require('fs'),
	codeCache		= { },
	fileLastStat	= { },
	fileStat		= { },
	fileMTimes		= { },
	global			= { },
	tagRx			= /^([\s\S]*?)<([%&][\?=]?) *([\s\S]+?)(?: *\|\s*(h|u|p))? *([\-=]{0,2})[%&]>([\s\t]*)/;


function process(file,args,handler) {

	return this.processFile(file,args,handler);

}

function processFile(file,args,handler) {

	var
		self = this;

	// Load template
	return loadTemplate(this,file,function(err,jsCode,xcode){
		if ( err ) {
			console.log("Error loading template file '"+file+"': ",err);
			return handler(err,null);
		}

		if ( jsCode == null ) {
			if ( file != "/default.jst" )
				return followFile("/default.jst",args,handler);
			else
				return handler(404,{'Content-type':'text/html'},'404 Not Found');
		}


		// The JST object
		var
			jst = {
				templateFile:	file,
				global:			global,

				_runCode:		jsCode,
				_runStack:		[ ],
				_o:				"",
				_indent:		0,

				next: function() {
					var
						nextCode;

					if ( jst._runStack.length == 0 )
						return;

					// Get next code tag
					nextCode = jst._runStack.shift();
					return nextCode(jst,args) || "";

				},
				include: function(file,args,indent) {
					this._indent += indent;
					_templateInclude(this,file,args);
					this._indent -= indent;
				},
				print: function(value) {
					var jst = this;
					if ( typeof value == "undefined" || value == null )
						return;
					if ( this._indent ) {
						this._o += value.toString().replace(/\n/g,function(a,b){
							return "\n"+new Array(jst._indent+1).join(' ');
						});
					}
					else
						this._o += value;
				},
				dump: function(value){
					var jst = this;
					if(value instanceof Object || value instanceof Array){
						return this.print(JSON.stringify(value));
					}

					return this.print(value != null ? value.toString() : JOSN.stringify(null));
				},
				html: _html,
				url: _url,
				grep: _grep
			};

		// If we can use layout file
		if ( self.opts.useLayout != false ) {

			// Check for a /layout.jst
			return loadTemplate(self,"/layout.jst",function(err,layoutJSCode,xcode){
				if ( !err ) {
					// If have layout, add template code to running stash and run first the layout code
					if ( layoutJSCode ) {
						jst._runCode = layoutJSCode;
						jst._runStack.push(jsCode);
					}
				}
				jstRun(jst,args,handler);
			});

		}
		else {
			jstRun(jst,args,handler);
		}

	});

}

function jstRun(jst,args,handler) {

	// Run template code
	try {
		var
			result = jst._runCode(jst,args);

		handler(null,result);
	}
	catch(ex) {
		handler(ex,'JST template '+jst.templateFile+' running error: '+ex.toString()+"\n\n"+_pre(ex.stack));
	}

}

function loadTemplate(self,file,handler) {

	var
		now		= new Date(),
		f		= file.replace(/\/+/g,"/");

	// Stat file to see if something changed. If no... use cache!
	return statFile(self.opts.viewDir+"/"+f,self.opts.statInterval,function(err,stat){
		if ( err ) {
//			console.log("Error stating file '"+self.opts.viewDir+"/"+f+"': ",err);
			return handler(err,null);
		}
		if ( stat.isDirectory() )
			return handler(new Error("Template file '"+self.viewDir+"/"+f+"' is not a file but a directory"),null);

		// Check if file modify time is the same, if yes, return cache!
		if ( fileMTimes[f] != null && stat.mtime.getTime() == fileMTimes[f] && codeCache[f] != null )
			return handler(null,codeCache[f]);

		// Save modify time
		fileMTimes[f] = stat.mtime.getTime();

		// Read file contents
		fs.readFile(self.opts.viewDir+"/"+f,function(err,data){
			if ( err ) {
				if ( err.code == 'ENOENT' )
					return handler(null,null);
				return handler(err,null);
			}

			// Template found, convert to JS and eval it
			var
				jsCode = codeCache[f];

			// Changed ? go on!
			if ( jsCode != null )
				return handler(null,jsCode);

			// Convert template in JS code
			return convertTemplate(self,f,data.toString('utf-8'),true,function(err,code){
				if ( err )
					return handler(err,null,code);

				// Evaluate the code
				try {
					var _jstFn = null;
					jsCode = eval(code);
				}
				catch(ex) {
					return handler(ex.toString(),null,code);
				}

				// Cache the code
				codeCache[f] = jsCode;

				// It's ok
				handler(null,jsCode);
			});
		});

	});

}

function convertTemplate(self,compPath,str,main,handler) {

	var
		dontCallHandler = 0,
		matched = false,
		code = (main?'_jstFn = function(jst,args){\n':'');

	// No string, nothing to convert!
	if ( str == null )
		return "";

	// All lines starting with % will be <% LINE -%>
	str = str.replace(/^%\s*$/gm,"");
	str = str.replace(/^%([^>][^\n]*)$/gm,function(a,b){
		return b.match(/^\s*(\/\/.*)?$/) ? "" : "<% "+b+" -%>";
	});

	// All lines starting with %// will be ""
	str = str.replace(/^%\/\/([^>][^\n]*)$/gm,"");

	// Use regexp for getting content and expressions (special tags)
	do {
		matched = false;
		str = str.replace(tagRx,function(a,b,c,d,e,f,g){
			matched = true;
			// Find the number of indentation spaces/tabs
			var indent = (b && f.match(/=/) && b.match(/([ \t]+)$/)) ? RegExp.$1.length : 0;

			// If tag have - on the end, remove \n from the end of line
			if ( f == "-" )
				b = b.replace(/\s*\n\s*$/g,"");

			// If is an include, check if have arguments
			var
				path = null,
				args = "{}";

			if ( c == '&' && d.match(/^\s*([^\s\,]+)\,?(?:\s+(\{[\s\S]*\}|\S+))?\s*/) ) {
				path = RegExp.$1;
				args = RegExp.$2 || "{}";

				// Cleanup arguments
				if ( typeof(args) == "string" )
					args = args.replace(/\s*\n\s*/g," ");

				// If path have no extention, add
				if ( !path.match(/\.\w+$/) )
					path += ".jst";

			}

			// Build middle code
			var
				midCode =	(c == '%?' || c == '%=')	? '  jst.print('+((e == "h")?'_html':(e=="u"?'_url':''))+'( '+d.replace(/\n/g,' ')+' )); ' :
							(c == '%')          		? '  '+d.replace(/^\s*\/\/(.*)/mg,"").replace(/\/\*([\s\S]*?)\*\//,"").replace(/\n/g,' ') :
							(path && e != "p")  		? '  jst.include(\''+path+'\''+(args?','+args:'')+','+indent+');' :
							'';

			// If is an include, we need to preload the template code
			if ( path && path != compPath ) {
				dontCallHandler++;
				loadTemplate(self,path,function(err,data,xcode){
					if ( err ) {
						dontCallHandler -= 999999;
						return handler(new Error("Error loading template '"+path+"': "+err.toString()+"\n"+_pre("Code:"+xcode)),null);
					}
					if ( data == null ) {
						dontCallHandler -= 999999;
						return handler(new Error("Template '"+path+"' not found"),null);
					}

					// If I am the last, call handler!
					if ( --dontCallHandler == 0 )
						handler(null,code);
				});
			}

			// Add the code
			code += ((b.length > 0)?'  jst.print(\''+encodeText(b)+'\');\n':'') + (midCode+'\n');

			return f.match(/\-/) ? "" : g;
		});
	} while ( matched );

	// Last text
	str = str.replace(/^([\s\S]+?)$/,function(a,b){
		code += '  jst.print(\''+encodeText(b)+'\');\n';
		return "";
	});

	// Function finish
	code += (main?'\n  return jst._o;\n}':'');

	// If nothing is pending, call the handler!
	if ( dontCallHandler == 0 )
		handler(null,code);

}

function _templateInclude(jst,file,args) {
	var
		f = file;

	if ( !f.match(/\.\w+$/) )
		f += ".jst";

	f = f.replace(/\/+/,"/");
	
	try {
		codeCache[f] ? codeCache[f](jst,args) : "TEMPLATE '"+f+"' NOT PRELOADED.";
	}
	catch(ex){
		console.log("Template include exception on '"+codeCache[f].toString()+"'");
		throw ex;
	}
}

function encodeText(str) {
	str = str.replace(/\r/g,'\\r');
	str = str.replace(/\n/g,'\\n');
	str = str.replace(/'/g,'\\\'');
	return str;
}


// Stat a file
function statFile(f,interval,handler) {
	var
		now = new Date();

	// When was the last time that we stat'ed this file ?
	// Still between the statInterval ? Return cache!
	if ( interval != null && fileLastStat[f] != null && fileLastStat[f] > now.getTime()-interval )
		return handler(null,fileStat[f]);

	fs.stat(f,function(err,stat){
		if ( err )
			return handler(err,null);

		fileLastStat[f] = now;
		fileStat[f] = stat;
		handler(null,stat);
	});
}

function _html(value) {
	return (typeof(value) == "undefined") ? "(undefined)" : (value == null) ? "(null)" : value.toString().toString().replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function _url(value) {
	return (typeof(value) == "undefined") ? "(undefined)" : (value == null) ? "(null)" : escape(value.toString());
}
function _pre(code) {
	return (typeof(code) == "undefined")  ? "(undefined)" : (code == null) ? "(null)" : "<code style='display:block'>"+code.toString().replace(/</g,"&lt;").replace(/&/g,"&amp;").replace(/\n/g,"<br/>")+"</code>";
}
function _grep(list, field, expr){
	var
		res = [];
	list.forEach(function(el){
		if ( expr(el) )
			res.push(el);
	})
	return res;
}

// self object
module.exports = function(opts){

	// JST options
	this.opts = {};

	if ( typeof opts == "string" )
		this.opts.viewDir = opts;
	else {
		for ( var p in opts )
			this.opts[p] = opts[p];
	}

	// Defaults
	if ( !this.opts.statInterval )
		this.opts.statInterval = 5000;
	if ( this.opts.useLayout == null )
		this.opts.useLayout = true;

	// Check
	if ( !this.opts.viewDir )
		throw Error("Invalid or unextistent 'viewDir' option");

	// Methods
	this.process		= process;
	this.processFile	= processFile; 

};
