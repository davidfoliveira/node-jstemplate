var
	JST = require('../jst'),
	jst = new JST("views");


jst.process("basic.jst",{sir:process.env['LOGNAME']},function(err,output){
	if ( err )
		throw err;
	var exp = "X Hello Mr "+process.env['LOGNAME'];
	if ( output != exp ) {
		console.log("Error! Expecting '"+exp+"' and got '"+output+"'!");
		return process.exit(-1);
	}
	console.log("OK");
	return process.exit(0);
});
