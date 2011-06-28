/*!
 * Copyright (c) 2011 Benjamin Dumke
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is furnished
 * to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
 
(function () {

    var arrIndexOf;
    if (Array.prototype.indexOf) {
        arrIndexOf = function (arr, val) { return arr.indexOf(val); };
    } else {
        arrIndexOf = function (arr, val) {
            var len = arr.length;
            for (var i = 0; i < len; i++)
                if (i in arr && arr[i] === val)
                    return i;
            return -1;
        };
    }

    var BreakIteration = {};

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
    
    var asGenerator = function (source) {
        if (source instanceof Generator)
            return source;
            
        return new Generator(source);
    };

    var stopIteration = function () {
        throw BreakIteration; 
    };
    
    var IterationError = function (message) {
        this.message = message;
        this.name = "IterationError";
    };
    IterationError.prototype = Error.prototype;

    var makeForEach_fromFunction = function (f) {
        return function (g, thisObj) {
            var stopped = false,
                index = 0,
                gen = {
                    yield: function (val) {
                        if (stopped)
                            throw new IterationError("yield after end of iteration");
                        var send = g.call(thisObj, val, index, stopIteration);
                        index++;
                        return send;
                    },
                    yieldMany: function (source) { asGenerator(source).forEach(function (val) { gen.yield(val); }) },
                    stop: stopIteration
                };
            try {
                f.call(gen);
            } catch (ex) {
                if (ex !== BreakIteration)
                    throw ex;
            } finally {
                stopped = true;
            }
        };
    };
    
    var makeForEach_fromArray = function (arr) {
        return makeForEach_fromFunction(function () {
            var len = arr.length;
            for (var i = 0; i < len; i++)
                if (i in arr)
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
        filter: function (pred, thisObj) {
            var source = this;
            return new Generator(function () {
                var gen = this;
                source.forEach(function (val) {
                    if (pred.call(thisObj, val))
                        gen.yield(val);
                });
            });
        },
        take: function (n) {
            var source = this;
            return new Generator(function () {
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
            return new Generator(function () {
                var gen = this;
                source.forEach(function(val, index) {
                    if (index >= n)
                        gen.yield(val);
                });
            });
        },
        map: function (f, thisObj) {
            var source = this;
            return new Generator(function () {
                var gen = this;
                source.forEach(function (val) {
                    gen.yield(f.call(thisObj, val));
                });
            });
        },
        zipWithArray: function (arr, zipper) {
            if (typeof zipper === "undefined")
                zipper = function (a, b) { return [a, b]; };
            
            var source = this;
            
            return new Generator(function () {
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
            return new Generator(function () {
                this.yieldMany(source);
                this.yieldMany(other);
            });
        },
        takeWhile: function (pred) {
            var source = this;
            
            return new Generator(function () {
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
            
            return new Generator(function () {
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
            var source = this;

            return new Generator(function () {
                var groups = [],
                    group_contents = [];
                    
                source.forEach(function (val) {
                    var group = grouper(val);
                    var i = arrIndexOf(groups, group);
                    if (i === -1) {
                        groups.push(group);
                        group_contents.push([val]);
                    } else {
                        group_contents[i].push(val);
                    }
                });
            
                this.yieldMany(new Generator(groups).zipWithArray(group_contents, function (group, contents) {
                    var result = new Generator(contents);
                    result.key = group;
                    return result;
                }));
            });
        },
        evaluated: function () {
            return new Generator(this.toArray());
        }
    }

    var Count = function (start, step) {
        var i = start;
        if (typeof step === "undefined")
            step = 1;
        return new Generator(function () {
            while (true) {
                this.yield(i);
                i += step;
            }
        });
    }

    var Range = function (start, len) {
        return Count(start, 1).take(len);
    }

    window.Generator = Generator;
    Generator.BreakIteration = BreakIteration;
    Generator.Count = Count;
    Generator.Range = Range;
    Generator.IterationError = IterationError;
    
})();

