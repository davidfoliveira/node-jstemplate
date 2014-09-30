# JSTemplate - A pure Javascript templating engine for node.js

`JSTemplate` is a simple and pure-Javascript templating engine for node.js

## Installing

	npm install jstemplate

## A basic template

	<%
	   var
	        title = "Mr";
	-%>
	Hello <%= title %> <%= args.sir -%>

## Processing a template

	var
	    JSTemplate = require('jstemplate'),
		jst = new JSTemplate({viewDir: 'views'});
	
	jst.process("basic.jst",{sir:process.env.LOGNAME},function(err,output){
	    if ( err )
	        throw err;
	    console.log(output);
	});

## Settings

The JSTemplate object supports the following settings:

- `viewDir` : The directory containing the templates (or views)

- `statInterval` : The interval of time (in ms) that a template file is stat()'ed and the modify time is watched to see if the template file was changed. Default to `5000`

- `useLayout` : Defines if the layout.jst will be used to encapsulate the result of the processed template. Defaults to: `true`

## The syntax

- `<% CODE %>` : Everything between `<%` and `%>` will be evaluated as javascript. Example: `<% var x = 666; %>` 

- `<%= VARIABLE|STATEMENT %>` or `<%? VARIABLE|STATEMENT %>` : Prints the result of a variable or statement

- `<& file.jst, {a:1,b:2} | p &>` : Includes template file.jst and pass `{a:1,b:2}` as arguments (`args` variable); Optional `| p` flag can be passed to just pre-process the template so it can be included with `jst.include()`


## Spaces and indentation

Optionally all tags can finish with a `-` (example `<% args.somevar -%>`) telling that the next return's should be discarded;


## Accessible variables

These variable are accessible by the template code:

- `args` : The object containing the template arguments

- `jst` : The global JSTemplate object


## API

The JSTemplate object exposes the following API:

- `print(str)` : Prints a string

- `dump(obj)` : Prints the dump of an object

- `include(file,args)` : Includes a template and call it with the specified arguments

- `next()` : Calls the next template on the execution stack (ninjas only)

- `html(str)` : Converts some data on something that is safe to use on a HTML page

- `url(str)` : Converts some data on something linkable (escape)

- `global` variable : A place where you can store some global data


## Questions and suggestions

Mail me.
