var traverse = require('traverse');
var objectKeys = require('./keys');
var forEach = require('./foreach');

function indexOf (xs, x) {
    if (xs.indexOf) return xs.indexOf(x);
    for (var i = 0; i < xs.length; i++) if (xs[i] === x) return i;
    return -1;
}

// scrub callbacks out of requests in order to call them again later
module.exports = function (callbacks) {
    var self = {};
    self.callbacks = callbacks || [];
    
    // Take the functions out and note them for future use
    self.scrub = function (obj) {
        var paths = {};
        var links = [];
        
        var args = traverse(obj).map(function (node) {
            if (typeof node === 'function') {
                var i = indexOf(self.callbacks, node);
                if (i >= 0 && !(i in paths)) {
                    // Keep previous function IDs only for the first function
                    // found. This is somewhat suboptimal but the alternatives
                    // are worse.
                    paths[i] = this.path;
                }
                else {
                    var id = self.callbacks.push(node) - 1;
                    paths[id] = this.path;
                }
                
                this.update('[Function]');
            }
            else if (this.circular) {
                links.push({ from : this.circular.path, to : this.path });
                this.update('[Circular]');
            }
        });
        
        return {
            arguments : args,
            callbacks : paths,
            links : links
        };
    };
    
    // Replace callbacks. The supplied function should take a callback id and
    // return a callback of its own.
    self.unscrub = function (msg, f) {
        var args = msg.arguments || [];
        forEach(objectKeys(msg.callbacks || {}), function (strId) {
            var id = parseInt(strId, 10);
            var path = msg.callbacks[id];
            traverse.set(args, path, f(id));
        });
        
        forEach(msg.links || [], function (link) {
            var value = traverse.get(args, link.from);
            traverse.set(args, link.to, value);
        });
        
        return args;
    };
    
    return self;
}