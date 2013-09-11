
Package.describe({
  summary: "Write your templates using Handlebars and Jade instead of HTML and Handlebars"
});

Package._transitional_registerBuildPlugin({
  name: "jade-handlebars",
  use: ['handlebars'],
  sources: [
    'html_scanner.js',
    'compile-jade-handlebars.js'
  ],
  npmDependencies: {
    "StringScanner": "0.0.3",
    "jade": "0.35.0"
  }
});
Package.on_use(function (api) {
  api.use(['underscore', 'spark', 'handlebars'], 'client');
  api.imply(['meteor', 'spark'], 'client');
});
