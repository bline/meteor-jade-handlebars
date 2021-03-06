
StringScanner = Npm.require('StringScanner');
jade = Npm.require('jade');
path = Npm.require('path');

var handler = function(compileStep) {
  if (! compileStep.archMatches('browser'))
    return;

  // Variables
  var lineno = 0;
  var lines = [];
  var json = [];
  var handlebarsPattern = /\s*(\{\{.*(?!\{\{)\}\})/;

  // Handlebars hack
  // Read the file content and create JSON
  try{
    // Create the string scanner with the .jade file content
    var ss = new StringScanner(compileStep.read().toString('utf8'));
    ss.reset();
    // Parse the file content until the end
    var EOL = "(?:\r\n|\r|\n)";
    while(!ss.endOfString()){
      // Scan content per line
      var res = ss.scan(new RegExp(EOL + "*^([\t ]*)(.*)$" + EOL + "*", 'm'));
      if (typeof res === "undefined" || res === null) {
        console.log("Parsing failed at", compileStep.inputPath, ":", lineno);
        break
      }
      lineno = lineno + res.split(new RegExp(EOL)).length;
      // Get the indentation of the line
      var indent = ss.captures()[0].length;
      
      // Get the content of the line
      value = ss.captures()[1];

      // Variables for json
      var child = [];
      var tags = []

      // Scan the content of the line to find handlebars tags
      ss_line = new StringScanner(value);  
      ss_line.reset();
      while(ss_line.checkUntil(handlebarsPattern)){
        ss_line.scanUntil(handlebarsPattern);
        tags.push({"position": ss_line.pointer()-ss_line.captures()[0].length, "value": ss_line.captures()[0] });
      }
      // End scan
      ss_line.terminate();

      // Create the JSON for the line
      line = {"indent": indent, "content": value, "tags": tags, "child": child};

      // Find arborescence
      // If the line is root
      if(line.indent == 0){
        // Add to the main JSON
        json.push(line);
      }else{
        // Add the child to the parent
        for(var i=lines.length-1; i >= 0; i--){
          if(lines[i].indent < line.indent){
            lines[i].child.push(line);
            break;
          }
        }  
      }  
      lines.push(line);   
    }
    // End scan
    ss.terminate();
  } catch(err) {
    // XXX better error handling, once the Plugin interface support it
    throw err
    throw new Error(
      compileStep.inputPath + ':' + lineno + ":" +
      err.message
    );

  }

  // Fix indentation
  json = jsonParser(json);

  // JSON to string
  global.contents_tmp = ""; // used in jsonToContents() function
  contents = jsonToContents(json); 
  
  // Jade parser
  var jade_options = { pretty: true };

  jade.render(contents, jade_options, function(err, html){
    if (err) throw err;
    contents = html;
  });


  // from meteor compile-template.js
  try {
    var results = html_scanner.scan(contents.toString('utf8'), compileStep.inputPath);
  } catch (e) {
    if (e instanceof html_scanner.ParseError) {
      compileStep.error({
        message: e.message,
        sourcePath: compileStep.inputPath,
        line: e.line
      });
      return;
    } else
      throw e;
  }

  if (results.head)
    compileStep.appendDocument({ section: "head", data: results.head });

  if (results.body)
    compileStep.appendDocument({ section: "body", data: results.body });

  if (results.js) {
    var path_part = path.dirname(compileStep.inputPath);
    if (path_part === '.')
      path_part = '';
    if (path_part.length && path_part !== path.sep)
      path_part = path_part + path.sep;
    var ext = path.extname(compileStep.inputPath);
    var basename = path.basename(compileStep.inputPath, ext);

    // XXX generate a source map

    compileStep.addJavaScript({
      path: path.join(path_part, "template." + basename + ".js"),
      sourcePath: compileStep.inputPath,
      data: results.js
    });
  }
}

function jsonParser(json) {
  // Number fo indentation
  n = 2;
  // Start the loop
  json.forEach(function(root){
    root.child.forEach(function(child){            
      // If line doesn't have HB tag
      if(root.tags.length < 1){
        child.indent = root.indent+n;
      }
      // If line has HB tag and start with HB tag and not comment
      else if(root.tags.length > 0 && root.tags[0].position == 0 && !root.content.match(/^\/\/\-*.*/)) {
          child.indent = root.indent;
      }
      else if(root.tags.length > 0 && root.tags[0].position != 0 && !root.content.match(/^\/\/\-*.*/)) {
          child.indent = root.indent+n;
      }
      // If child has child, recursive call  
      if(child.child.length > 0)
        jsonParser([child]);
    });
  });
  return json;
}

function jsonToContents(json) {
  for(line in json){
    for(attr in json[line]){
        
      if(attr == "content"){
        global.contents_tmp += Array(json[line].indent+1).join(" ") + json[line][attr] + "\n";
      } 
      else if(attr == "child" && typeof(json[line][attr]) == "object") {
          jsonToContents(json[line][attr]);
      }
    }
  }
  return global.contents_tmp;
}

Plugin.registerSourceHandler("jade", handler);

