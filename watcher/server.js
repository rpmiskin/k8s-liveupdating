const chokidar = require('chokidar');
const watchPath = './monitor';


console.log(`Starting to watch ${watchPath}`);
chokidar.watch('./monitor', {persistent:true}).on('all', (event, path)=>{console.log(event, path)});
