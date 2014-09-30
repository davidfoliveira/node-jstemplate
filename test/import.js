var
	JST = require('../jst'),
	jst = new JST("views");


jst.process("import_main.jst",{sir:process.env['LOGNAME']},function(err,output){
	if ( err )
		throw err;
	var exp = "Hello Mr "+process.env['LOGNAME'];
	if ( output != exp ) {
		console.log("Error! Expecting '"+exp+"' and got '"+output+"'!");
		return process.exit(-1);
	}
	console.log("OK");
	return process.exit(0);
});
