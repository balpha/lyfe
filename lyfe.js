(function () {

    function arrIndexOf(arr, val) {
        if (arr.indexOf)
            return arr.indexOf(val);
        var len = arr.length;
        for (var i = 0; i < len; i++)
            if (arr[i] === val)
                return i;
        return -1;
    }

    var BreakIteration = new Error();

    var Generator = function (source) {
        if (!(this instanceof Generator))
            return new Generator(source);
    
        if (typeof source === "function")
            this.forEach = makeForEach_fromFunction(source);
        else if (source.constructor === Array)
            this.forEach = makeForEach_fromArray(source);
        else
            this.forEach = makeForEach_fromObject(source);
    };

    var stopIteration = function () {
        throw BreakIteration; 
    };

    var makeForEach_fromFunction = function (f) {
        return function (g) {
            var index = 0,
                gen = {
                    yield: function (val) { var send = g(val, index, stopIteration); index++; return send; },
                    yieldMany: function (source) { source.forEach(function (val) { gen.yield(val); }) },
                    stop: stopIteration
                };
            try {
                f.call(gen);
            } catch (ex) {
                if (ex !== BreakIteration)
                    throw ex;
            }
        };
    };
    
    var makeForEach_fromArray = function (arr) {
        return makeForEach_fromFunction(function () {
            var len = arr.length;
            for (var i = 0; i < len; i++)
                this.yield(arr[i]);
        });
    };
    
    var makeForEach_fromObject = function (obj) {
        return makeForEach_fromFunction(function () {
            for (var key in obj)
                if (obj.hasOwnProperty(key))
                    this.yield([key, obj[key]]);
        });
    };

    Generator.prototype = {
        toArray: function () {
            var result = [];
            this.forEach(function (val) { result.push(val); });
            return result;
        },
        filter: function (pred) {
            var source = this;
            return Generator(function () {
                var gen = this;
                source.forEach(function (val) {
                    if (pred(val))
                        gen.yield(val);
                });
            });
        },
        take: function (n) {
            var source = this;
            return Generator(function () {
                var gen = this;
                source.forEach(function (val, index) {
                    if (index >= n)
                        gen.stop();
                    gen.yield(val);
                });
            });
        },
        skip: function (n) {
            var source = this;
            return Generator(function () {
                var gen = this;
                source.forEach(function(val, index) {
                    if (index >= n)
                        gen.yield(val);
                });
            });
        },
        map: function (f) {
            var source = this;
            return Generator(function () {
                var gen = this;
                source.forEach(function (val) {
                    gen.yield(f(val));
                });
            });
        },
        zipWithArray: function (arr, zipper) {
            if (typeof zipper === "undefined")
                zipper = function (a, b) { return [a, b]; };
            
            var source = this;
            
            return Generator(function () {
                var len = arr.length,
                    gen = this;
                    
                source.forEach(function (val, index) {
                    if (index >= len)
                        gen.stop();
                    gen.yield(zipper(val, arr[index]));
                });
            });
        },
        reduce: function (f, firstValue) {
            var first,
                current;
        
            if (arguments.length < 2) { 
                first = true;
            } else {
                first = false;
                current = firstValue;
            }
            
            this.forEach(function (val) {
                if (first) {
                    current = val;
                    first = false;
                } else {
                    current = f(current, val);
                }                
            });
            return current;
        },
        and: function (other) {
            var source = this;
            return Generator(function () {
                this.yieldMany(source);
                this.yieldMany(other);
            });
        },
        takeWhile: function (pred) {
            var source = this;
            
            return Generator(function () {
                var gen = this;
                source.forEach(function (val) {
                    if (pred(val))
                        gen.yield(val);
                    else
                        gen.stop();
                });
            });
        },
        skipWhile: function (pred) {
            var source = this;
            
            return Generator(function () {
                var gen = this,
                    skipping = true;
                    
                source.forEach(function (val) {
                    skipping = skipping && pred(val);
                    if (!skipping)
                        gen.yield(val);
                });                    
            });
        },
        all: function () {
            var result = true;
            this.forEach(function (val, index, stop) {
                if (!val) {
                    result = false;
                    stop();
                }
            });
            return result;
        },
        any: function () {
            var result = false;
            this.forEach(function (val, index, stop) {
                if (val) {
                    result = true;
                    stop();
                }
            });
            return result;
        },
        first: function () {
            var result;
            this.forEach(function (val, index, stop) {
                result = val;
                stop();
            });
            return result;
        },
        groupBy: function (grouper) {
            var groups = [],
                group_contents = [];
                
            this.forEach(function (val) {
                var group = grouper(val);
                var i = arrIndexOf(groups, group);
                if (i === -1) {
                    groups.push(group);
                    group_contents.push([val]);
                } else {
                    group_contents[i].push(val);
                }
            });
            
            return Generator(groups).zipWithArray(group_contents, function (group, contents) {
                var result = Generator(contents);
                result.key = group;
                return result;
            });
        }
    }

    window.Generator = Generator;
    window.Lyfe = {
        BreakIteration: BreakIteration
    };
    
    Lyfe.Count = function (start, step) {
        var i = start;
        if (typeof step === "undefined")
            step = 1;
        return Generator(function () {
            while (true) {
                this.yield(i);
                i += step;
            }
        });
    }

    Lyfe.Range = function (start, len) {
        return Count(start, 1).take(len);
    }
    
})();

