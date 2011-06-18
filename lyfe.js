BreakIteration = new Error();

Iterator = function () {};

Iterator.prototype = {
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
            var i = 0, gen = this;
            source.forEach(function (val) {
                if (i >= n)
                    gen.stop();
                gen.yield(val);
                i++;
            });
        });
    },
    skip: function (n) {
        var source = this;
        return Generator(function () {
            var gen = this, i = 0;
            source.forEach(function(val) {
                if (i >= n)
                    gen.yield(val);
                i++;
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
            var i = 0,
                len = arr.length,
                gen = this;
                
            source.forEach(function (val) {
                if (i >= len)
                    gen.stop();
                gen.yield(zipper(val, arr[i]));
                i++;
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
    }
}

Generator = function (source) {
    if (typeof source === "function")
        return Generator.fromFunction(source);
    else if (source.constructor === Array)
        return Generator.fromArray(source);
    else
        return Generator.fromObject(source);
}

Generator.fromFunction = function (f) {
    var result = new Iterator();
    var stop = function () { throw BreakIteration; }
    result.forEach = function (g) {
        var index = 0,
            gen = {
                yield: function (val) { var send = g(val, index, stop); index++; return send; },
                yieldMany: function (source) { source.forEach(function (val) { gen.yield(val); }) },
                stop: stop
            };
        try {
            f.call(gen);
        } catch (ex) {
            if (ex !== BreakIteration)
                throw ex;
        }
    };
    return result;
}

Generator.fromArray = function (arr) {
    var len = arr.length;
    return Generator.fromFunction(function () {
        for (var i = 0; i < len; i++)
            this.yield(arr[i]);
    });
}

Generator.fromObject = function (obj) {
    return Generator.fromFunction(function () {
        for (var key in obj)
            if (obj.hasOwnProperty(key))
                this.yield([key, obj[key]]);
    });
}

Count = function (start, step) {
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

Range = function (start, len) {
    return Count(start, 1).take(len);
}
