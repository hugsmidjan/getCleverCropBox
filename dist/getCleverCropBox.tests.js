'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var getCleverCropBox = require('./getCleverCropBox.js');
var util = _interopDefault(require('util'));

function createCommonjsModule(fn, module) {
	return module = { exports: {} }, fn(module, module.exports), module.exports;
}

var ospec = createCommonjsModule(function (module) {
(function(m) {
{ module["exports"] = m(); }
})(function init(name) {
	var spec = {}, subjects = [], results, only = [], ctx = spec, start, stack = 0, nextTickish, hasProcess = typeof process === "object", hasOwn = ({}).hasOwnProperty;
	var ospecFileName = getStackName(ensureStackTrace(new Error), /[\/\\](.*?):\d+:\d+/), timeoutStackName;
	var globalTimeout = noTimeoutRightNow;
	var currentTestError = null;
	if (name != null) { spec[name] = ctx = {}; }

	try {throw new Error} catch (e) {
		var ospecFileName = e.stack && (/[\/\\](.*?):\d+:\d+/).test(e.stack) ? e.stack.match(/[\/\\](.*?):\d+:\d+/)[1] : null;
	}
	function o(subject, predicate) {
		if (predicate === undefined) {
			if (!isRunning()) { throw new Error("Assertions should not occur outside test definitions") }
			return new Assert(subject)
		} else {
			if (isRunning()) { throw new Error("Test definitions and hooks shouldn't be nested. To group tests use `o.spec()`") }
			subject = String(subject);
			if (subject.charCodeAt(0) === 1) { throw new Error("test names starting with '\\x01' are reserved for internal use") }
			ctx[unique(subject)] = new Task(predicate, ensureStackTrace(new Error));
		}
	}
	o.before = hook("\x01before");
	o.after = hook("\x01after");
	o.beforeEach = hook("\x01beforeEach");
	o.afterEach = hook("\x01afterEach");
	o.specTimeout = function (t) {
		if (isRunning()) { throw new Error("o.specTimeout() can only be called before o.run()") }
		if (hasOwn.call(ctx, "\x01specTimeout")) { throw new Error("A default timeout has already been defined in this context") }
		if (typeof t !== "number") { throw new Error("o.specTimeout() expects a number as argument") }
		ctx["\x01specTimeout"] = t;
	};
	o.new = init;
	o.spec = function(subject, predicate) {
		var parent = ctx;
		ctx = ctx[unique(subject)] = {};
		predicate();
		ctx = parent;
	};
	o.only = function(subject, predicate, silent) {
		if (!silent) { console.log(
			highlight("/!\\ WARNING /!\\ o.only() mode") + "\n" + o.cleanStackTrace(ensureStackTrace(new Error)) + "\n",
			cStyle("red"), ""
		); }
		only.push(predicate);
		o(subject, predicate);
	};
	o.spy = function(fn) {
		var spy = function() {
			spy.this = this;
			spy.args = [].slice.call(arguments);
			spy.calls.push({this: this, args: spy.args});
			spy.callCount++;

			if (fn) { return fn.apply(this, arguments) }
		};
		if (fn)
			{ Object.defineProperties(spy, {
				length: {value: fn.length},
				name: {value: fn.name}
			}); }
		spy.args = [];
		spy.calls = [];
		spy.callCount = 0;
		return spy
	};
	o.cleanStackTrace = function(error) {
		// For IE 10+ in quirks mode, and IE 9- in any mode, errors don't have a stack
		if (error.stack == null) { return "" }
		var i = 0, header = error.message ? error.name + ": " + error.message : error.name, stack;
		// some environments add the name and message to the stack trace
		if (error.stack.indexOf(header) === 0) {
			stack = error.stack.slice(header.length).split(/\r?\n/);
			stack.shift(); // drop the initial empty string
		} else {
			stack = error.stack.split(/\r?\n/);
		}
		if (ospecFileName == null) { return stack.join("\n") }
		// skip ospec-related entries on the stack
		while (stack[i] != null && stack[i].indexOf(ospecFileName) !== -1) { i++; }
		// now we're in user code (or past the stack end)
		return stack[i]
	};
	o.timeout = function(n) {
		globalTimeout(n);
	};
	o.run = function(reporter) {
		results = [];
		start = new Date;
		test(spec, [], [], new Task(function() {
			setTimeout(function () {
				timeoutStackName = getStackName({stack: o.cleanStackTrace(ensureStackTrace(new Error))}, /([\w \.]+?:\d+:\d+)/);
				if (typeof reporter === "function") { reporter(results); }
				else {
					var errCount = o.report(results);
					if (hasProcess && errCount !== 0) { process.exit(1); } // eslint-disable-line no-process-exit
				}
			});
		}, null), 200 /*default timeout delay*/);

		function test(spec, pre, post, finalize, defaultDelay) {
			if (hasOwn.call(spec, "\x01specTimeout")) { defaultDelay = spec["\x01specTimeout"]; }
			pre = [].concat(pre, spec["\x01beforeEach"] || []);
			post = [].concat(spec["\x01afterEach"] || [], post);
			series([].concat(spec["\x01before"] || [], Object.keys(spec).reduce(function(tasks, key) {
				if (key.charCodeAt(0) !== 1 && (only.length === 0 || only.indexOf(spec[key].fn) !== -1 || !(spec[key] instanceof Task))) {
					tasks.push(new Task(function(done) {
						o.timeout(Infinity);
						subjects.push(key);
						var pop = new Task(function pop() {subjects.pop(), done();}, null);
						if (spec[key] instanceof Task) { series([].concat(pre, spec[key], post, pop), defaultDelay); }
						else { test(spec[key], pre, post, pop, defaultDelay); }
					}, null));
				}
				return tasks
			}, []), spec["\x01after"] || [], finalize), defaultDelay);
		}

		function series(tasks, defaultDelay) {
			var cursor = 0;
			next();

			function next() {
				if (cursor === tasks.length) { return }

				var task = tasks[cursor++];
				var fn = task.fn;
				currentTestError = task.err;
				var timeout = 0, delay = defaultDelay, s = new Date;
				var current = cursor;
				var arg;

				globalTimeout = setDelay;

				var isDone = false;
				// public API, may only be called once from use code (or after returned Promise resolution)
				function done(err) {
					if (!isDone) { isDone = true; }
					else { throw new Error("`" + arg + "()` should only be called once") }
					if (timeout === undefined) { console.warn("# elapsed: " + Math.round(new Date - s) + "ms, expected under " + delay + "ms\n" + o.cleanStackTrace(task.err)); }
					finalizeAsync(err);
				}
				// for internal use only
				function finalizeAsync(err) {
					if (err == null) {
						if (task.err != null) { succeed(new Assert); }
					} else {
						if (err instanceof Error) { fail(new Assert, err.message, err); }
						else { fail(new Assert, String(err), null); }
					}
					if (timeout !== undefined) { timeout = clearTimeout(timeout); }
					if (current === cursor) { next(); }
				}
				function startTimer() {
					timeout = setTimeout(function() {
						timeout = undefined;
						finalizeAsync("async test timed out after " + delay + "ms");
					}, Math.min(delay, 2147483647));
				}
				function setDelay (t) {
					if (typeof t !== "number") { throw new Error("timeout() and o.timeout() expect a number as argument") }
					delay = t;
				}
				if (fn.length > 0) {
					var body = fn.toString();
					arg = (body.match(/^(.+?)(?:\s|\/\*[\s\S]*?\*\/|\/\/.*?\n)*=>/) || body.match(/\((?:\s|\/\*[\s\S]*?\*\/|\/\/.*?\n)*(.+?)(?:\s|\/\*[\s\S]*?\*\/|\/\/.*?\n)*[,\)]/) || []).pop();
					if (body.indexOf(arg) === body.lastIndexOf(arg)) {
						var e = new Error;
						e.stack = "`" + arg + "()` should be called at least once\n" + o.cleanStackTrace(task.err);
						throw e
					}
					try {
						fn(done, setDelay);
					}
					catch (e) {
						if (task.err != null) { finalizeAsync(e); }
						// The errors of internal tasks (which don't have an Err) are ospec bugs and must be rethrown.
						else { throw e }
					}
					if (timeout === 0) {
						startTimer();
					}
				} else {
					try{
						var p = fn();
						if (p && p.then) {
							startTimer();
							p.then(function() { done(); }, done);
						} else {
							nextTickish(next);
						}
					} catch (e) {
						if (task.err != null) { finalizeAsync(e); }
						// The errors of internal tasks (which don't have an Err) are ospec bugs and must be rethrown.
						else { throw e }
					}
				}
				globalTimeout = noTimeoutRightNow;
			}
		}
	};
	function unique(subject) {
		if (hasOwn.call(ctx, subject)) {
			console.warn("A test or a spec named `" + subject + "` was already defined");
			while (hasOwn.call(ctx, subject)) { subject += "*"; }
		}
		return subject
	}
	function hook(name) {
		return function(predicate) {
			if (ctx[name]) { throw new Error("This hook should be defined outside of a loop or inside a nested test group:\n" + predicate) }
			ctx[name] = new Task(predicate, ensureStackTrace(new Error));
		}
	}

	define("equals", "should equal", function(a, b) {return a === b});
	define("notEquals", "should not equal", function(a, b) {return a !== b});
	define("deepEquals", "should deep equal", deepEqual);
	define("notDeepEquals", "should not deep equal", function(a, b) {return !deepEqual(a, b)});
	define("throws", "should throw a", throws);
	define("notThrows", "should not throw a", function(a, b) {return !throws(a, b)});

	function isArguments(a) {
		if ("callee" in a) {
			for (var i in a) { if (i === "callee") { return false } }
			return true
		}
	}
	function deepEqual(a, b) {
		if (a === b) { return true }
		if (a === null ^ b === null || a === undefined ^ b === undefined) { return false } // eslint-disable-line no-bitwise
		if (typeof a === "object" && typeof b === "object") {
			var aIsArgs = isArguments(a), bIsArgs = isArguments(b);
			if (a.constructor === Object && b.constructor === Object && !aIsArgs && !bIsArgs) {
				for (var i in a) {
					if ((!(i in b)) || !deepEqual(a[i], b[i])) { return false }
				}
				for (var i in b) {
					if (!(i in a)) { return false }
				}
				return true
			}
			if (a.length === b.length && (a instanceof Array && b instanceof Array || aIsArgs && bIsArgs)) {
				var aKeys = Object.getOwnPropertyNames(a), bKeys = Object.getOwnPropertyNames(b);
				if (aKeys.length !== bKeys.length) { return false }
				for (var i = 0; i < aKeys.length; i++) {
					if (!hasOwn.call(b, aKeys[i]) || !deepEqual(a[aKeys[i]], b[aKeys[i]])) { return false }
				}
				return true
			}
			if (a instanceof Date && b instanceof Date) { return a.getTime() === b.getTime() }
			if (typeof Buffer === "function" && a instanceof Buffer && b instanceof Buffer) {
				for (var i = 0; i < a.length; i++) {
					if (a[i] !== b[i]) { return false }
				}
				return true
			}
			if (a.valueOf() === b.valueOf()) { return true }
		}
		return false
	}
	function throws(a, b){
		try{
			a();
		}catch(e){
			if(typeof b === "string"){
				return (e.message === b)
			}else{
				return (e instanceof b)
			}
		}
		return false
	}

	function isRunning() {return results != null}
	function Assert(value) {
		this.value = value;
		this.i = results.length;
		results.push({pass: null, context: "", message: "Incomplete assertion in the test definition starting at...", error: currentTestError, testError: currentTestError});
	}
	function Task(fn, err) {
		this.fn = fn;
		this.err = err;
	}
	function define(name, verb, compare) {
		Assert.prototype[name] = function assert(value) {
			var self = this;
			var message = serialize(self.value) + "\n  " + verb + "\n" + serialize(value);
			if (compare(self.value, value)) { succeed(self, message); }
			else { fail(self, message); }
			return function(message) {
				if (!self.pass) { self.message = message + "\n\n" + self.message; }
			}
		};
	}
	function succeed(assertion, message) {
		results[assertion.i].pass = true;
		results[assertion.i].context = subjects.join(" > ");
		results[assertion.i].message = message;
	}
	function fail(assertion, message, error) {
		results[assertion.i].pass = false;
		results[assertion.i].context = subjects.join(" > ");
		results[assertion.i].message = message;
		results[assertion.i].error = error != null ? error : ensureStackTrace(new Error);
	}
	function serialize(value) {
		if (hasProcess) { return util.inspect(value) } // eslint-disable-line global-require
		if (value === null || (typeof value === "object" && !(value instanceof Array)) || typeof value === "number") { return String(value) }
		else if (typeof value === "function") { return value.name || "<anonymous function>" }
		try {return JSON.stringify(value)} catch (e) {return String(value)}
	}
	function noTimeoutRightNow() {
		throw new Error("o.timeout must be called snchronously from within a test definition or a hook")
	}
	var colorCodes = {
		red: "31m",
		red2: "31;1m",
		green: "32;1m"
	};
	function highlight(message, color) {
		var code = colorCodes[color] || colorCodes.red;
		return hasProcess ? (process.stdout.isTTY ? "\x1b[" + code + message + "\x1b[0m" : message) : "%c" + message + "%c "
	}
	function cStyle(color, bold) {
		return hasProcess||!color ? "" : "color:"+color+(bold ? ";font-weight:bold" : "")
	}
	function ensureStackTrace(error) {
		// mandatory to get a stack in IE 10 and 11 (and maybe other envs?)
		if (error.stack === undefined) { try { throw error } catch(e) {return e} }
		else { return error }
	}
	function getStackName(e, exp) {
		return e.stack && exp.test(e.stack) ? e.stack.match(exp)[1] : null
	}

	o.report = function (results) {
		var errCount = 0;
		for (var i = 0, r; r = results[i]; i++) {
			if (r.pass == null) {
				r.testError.stack = r.message + "\n" + o.cleanStackTrace(r.testError);
				r.testError.message = r.message;
				throw r.testError
			}
			if (!r.pass) {
				var stackTrace = o.cleanStackTrace(r.error);
				var couldHaveABetterStackTrace = !stackTrace || timeoutStackName != null && stackTrace.indexOf(timeoutStackName) !== -1;
				if (couldHaveABetterStackTrace) { stackTrace = r.testError != null ? o.cleanStackTrace(r.testError) : r.error.stack || ""; }
				console.error(
					(hasProcess ? "\n" : "") +
					highlight(r.context + ":", "red2") + "\n" +
					highlight(r.message, "red") +
					(stackTrace ? "\n" + stackTrace + "\n" : ""),

					cStyle("black", true), "", // reset to default
					cStyle("red"), cStyle("black")
				);
				errCount++;
			}
		}
		var pl = results.length === 1 ? "" : "s";
		var resultSummary = (errCount === 0) ?
			highlight((pl ? "All " : "The ") + results.length + " assertion" + pl + " passed", "green"):
			highlight(errCount + " out of " + results.length + " assertion" + pl + " failed", "red2");
		var runningTime = " in " + Math.round(Date.now() - start) + "ms";

		console.log(
			(hasProcess ? "––––––\n" : "") +
			(name ? name + ": " : "") + resultSummary + runningTime,
			cStyle((errCount === 0 ? "green" : "red"), true), ""
		);
		return errCount
	};

	if (hasProcess) {
		nextTickish = process.nextTick;
	} else {
		nextTickish = function fakeFastNextTick(next) {
			if (stack++ < 5000) { next(); }
			else { setTimeout(next, stack = 0); }
		};
	}

	return o
});
});

var assertions = [
	{
		name: "No scaling requirements in input return null",
		input: {
			imageSize: {
				width: 1000,
				height: 600
			},
			cropInfo: {
			}
		},
		expected: null
	},
	{
		name: "Simple resizing (width)",
		input: {
			imageSize: {
				width: 1000,
				height: 600
			},
			cropInfo: {
				width: 300
			},
			focalPoint: {
				fx: 50,
				fy: 50
			}
		},
		expected: {
			doResize: true,
			scaledWidth: 300,
			scaledHeight: 180,
			doCrop: false,
			tooSmall: false
		}
	},
	{
		name: "Simple resizing (skipping focalPoint is allowed)",
		input: {
			imageSize: {
				width: 1000,
				height: 600
			},
			cropInfo: {
				width: 300
			}
		},
		expected: {
			doResize: true,
			scaledWidth: 300,
			scaledHeight: 180,
			doCrop: false,
			tooSmall: false
		}
	},
	{
		name: "off-center focalpoint should not influence simple resizing",
		input: {
			imageSize: {
				width: 1000,
				height: 600
			},
			cropInfo: {
				width: 500
			},
			focalPoint: {
				fx: 0,
				fy: 0
			}
		},
		expected: {
			doResize: true,
			scaledWidth: 500,
			scaledHeight: 300,
			doCrop: false,
			tooSmall: false
		}
	},
	{
		name: "rectangle should not influence simple resizing",
		input: {
			imageSize: {
				width: 1000,
				height: 600
			},
			cropInfo: {
				width: 500
			},
			focalPoint: {
				fx: 10,
				fy: 10,
				r1x: 0,
				r1y: 0,
				r2x: 20,
				r2y: 20
			}
		},
		expected: {
			doResize: true,
			scaledWidth: 500,
			scaledHeight: 300,
			doCrop: false,
			tooSmall: false
		}
	},
	{
		name: "Simple resizing (height)",
		input: {
			imageSize: {
				width: 1000,
				height: 600
			},
			cropInfo: {
				height: 300
			}
		},
		expected: {
			doResize: true,
			scaledWidth: 500,
			scaledHeight: 300,
			doCrop: false,
			tooSmall: false
		}
	},
	{
		name: "Simple resizing (width and height)",
		input: {
			imageSize: {
				width: 1000,
				height: 600
			},
			cropInfo: {
				width: 300,
				height: 300
			}
		},
		expected: {
			doResize: true,
			scaledWidth: 300,
			scaledHeight: 180,
			doCrop: false,
			tooSmall: false
		}
	},
	{
		name: "Simple resizing (image lower than specified height)",
		input: {
			imageSize: {
				width: 1000,
				height: 600
			},
			cropInfo: {
				width: 800,
				height: 800
			}
		},
		expected: {
			doResize: true,
			scaledWidth: 800,
			scaledHeight: 480,
			doCrop: false,
			tooSmall: false
		}
	},
	{
		name: "Simple resizing (image narrower than specified width)",
		input: {
			imageSize: {
				width: 1000,
				height: 600
			},
			cropInfo: {
				width: 1200,
				height: 400
			}
		},
		expected: {
			doResize: true,
			scaledWidth: 667,
			scaledHeight: 400,
			doCrop: false,
			tooSmall: false
		}
	},
	{
		name: "Image same size as scaling box",
		input: {
			imageSize: {
				width: 1000,
				height: 600
			},
			cropInfo: {
				width: 1000,
				height: 600
			}
		},
		expected: {
			doResize: false,
			doCrop: false,
			tooSmall: false
		}
	},
	{
		name: "Image smaller than scaling box (width + height)",
		input: {
			imageSize: {
				width: 1000,
				height: 600
			},
			cropInfo: {
				width: 1200,
				height: 1200
			}
		},
		expected: {
			doResize: false,
			doCrop: false,
			tooSmall: true,
			targetWidth: 1200,
			targetHeight: 720
		}
	},
	{
		name: "Image smaller than scaling box (width only)",
		input: {
			imageSize: {
				width: 1000,
				height: 600
			},
			cropInfo: {
				width: 1200
			}
		},
		expected: {
			doResize: false,
			doCrop: false,
			tooSmall: true,
			targetWidth: 1200,
			targetHeight: 720
		}
	},
	{
		name: "Image smaller than scaling box (height only)",
		input: {
			imageSize: {
				width: 1000,
				height: 600
			},
			cropInfo: {
				height: 1200
			}
		},
		expected: {
			doResize: false,
			doCrop: false,
			tooSmall: true,
			targetHeight: 1200,
			targetWidth: 2000
		}
	},
	{
		name: "Cropping without width or height returns null",
		input: {
			imageSize: {
				width: 1000,
				height: 600
			},
			cropInfo: {
				minRatioX: 2,
				minRatioY: 1,
				maxRatioX: 2,
				maxRatioY: 1
			}
		},
		expected: null
	},
	{
		name: "Crop with Height set above the possible crop-height",
		input: {
			imageSize: {
				width: 1000,
				height: 600
			},
			cropInfo: {
				width: 600,
				height: 550,
				minRatioX: 2,
				minRatioY: 1,
				maxRatioX: 2,
				maxRatioY: 1
			}
		},
		expected: {
			doCrop: true,
			xPos: 0,
			yPos: 50,
			cropWidth: 1000,
			cropHeight: 500,
			doResize: true,
			scaledWidth: 600,
			scaledHeight: 300,
			tooSmall: false
		}
	},
	{
		name: "Crop with Height set above the possible crop-height",
		input: {
			imageSize: {
				width: 1000,
				height: 600
			},
			cropInfo: {
				width: 600,
				height: 550,
				zoom: 101,
				minRatioX: 2,
				minRatioY: 1,
				maxRatioX: 2,
				maxRatioY: 1
			}
		},
		expected: {
			doCrop: true,
			xPos: 5,
			yPos: 52,
			cropWidth: 990,
			cropHeight: 495,
			doResize: true,
			scaledWidth: 600,
			scaledHeight: 300,
			tooSmall: false
		}
	},
	{
		name: "Image aspect ratio above maxRatio but too narrow to warrant cropping",
		input: {
			imageSize: {
				width: 1000,
				height: 600
			},
			cropInfo: {
				width: 1000,
				minRatioX: 10,
				minRatioY: 12,
				maxRatioX: 12,
				maxRatioY: 10
			}
		},
		expected: {
			doCrop: false,
			doResize: false,
			tooSmall: true,
			targetWidth: 1000,
			targetHeight: 833
		}
	},
	{
		name: "Image aspect ratio above maxRatio but too narrow to warrant cropping",
		input: {
			imageSize: {
				width: 1000,
				height: 600
			},
			cropInfo: {
				width: 1000,
				height: 1000,
				minRatioX: 10,
				minRatioY: 12,
				maxRatioX: 12,
				maxRatioY: 10
			}
		},
		expected: {
			doCrop: false,
			doResize: false,
			tooSmall: true,
			targetWidth: 1000,
			targetHeight: 833
		}
	},
	{
		name: "Image aspect ratio above maxRatio - requires cropping",
		input: {
			imageSize: {
				width: 1000,
				height: 600
			},
			cropInfo: {
				width: 500,
				minRatioX: 10,
				minRatioY: 12,
				maxRatioX: 12,
				maxRatioY: 10
			}
		},
		expected: {
			doCrop: true,
			xPos: 140,
			yPos: 0,
			cropWidth: 720,
			cropHeight: 600,
			doResize: true,
			scaledWidth: 500,
			scaledHeight: 417,
			tooSmall: false
		}
	},
	{
		name: "Aspect ratio may be floating-point numbers",
		input: {
			imageSize: {
				width: 1000,
				height: 600
			},
			cropInfo: {
				width: 500,
				minRatioX: 0.1,
				minRatioY: 0.12,
				maxRatioX: 0.12,
				maxRatioY: 0.1
			}
		},
		expected: {
			doCrop: true,
			xPos: 140,
			yPos: 0,
			cropWidth: 720,
			cropHeight: 600,
			doResize: true,
			scaledWidth: 500,
			scaledHeight: 417,
			tooSmall: false
		}
	},
	{
		name: "Image aspect ratio below minRatio - requires cropping",
		input: {
			imageSize: {
				width: 600,
				height: 1000
			},
			cropInfo: {
				width: 500,
				minRatioX: 10,
				minRatioY: 12,
				maxRatioX: 12,
				maxRatioY: 10
			}
		},
		expected: {
			doCrop: true,
			xPos: 0,
			yPos: 140,
			cropWidth: 600,
			cropHeight: 720,
			doResize: true,
			scaledWidth: 500,
			scaledHeight: 600,
			tooSmall: false
		}
	},
	{
		name: "minRatio > maxRatio should not be auto-corrected",
		input: {
			imageSize: {
				width: 600,
				height: 1000
			},
			cropInfo: {
				width: 500,
				minRatioX: 12,
				minRatioY: 10,
				maxRatioX: 10,
				maxRatioY: 12
			}
		},
		expected: null
	},
	{
		name: "Cropping points are rounded up/down to nearast integer",
		input: {
			imageSize: {
				width: 1000,
				height: 1000
			},
			cropInfo: {
				width: 500,
				minRatioX: 3,
				minRatioY: 2,
				maxRatioX: 3,
				maxRatioY: 2
			}
		},
		expected: {
			doCrop: true,
			xPos: 0,
			yPos: 167,
			cropWidth: 1000,
			cropHeight: 667,
			doResize: true,
			scaledWidth: 500,
			scaledHeight: 333,
			tooSmall: false
		}
	},
	{
		name: "Cropping points are rounded up/down to nearast integer",
		input: {
			imageSize: {
				width: 1000,
				height: 1000
			},
			cropInfo: {
				width: 500,
				minRatioX: 3,
				minRatioY: 1,
				maxRatioX: 3,
				maxRatioY: 1
			}
		},
		expected: {
			doCrop: true,
			xPos: 0,
			yPos: 333,
			cropWidth: 1000,
			cropHeight: 333,
			doResize: true,
			scaledWidth: 500,
			scaledHeight: 167,
			tooSmall: false
		}
	},
	{
		name: "Image Aspect ratio is within min/max Ratio bounds - no cropping",
		input: {
			imageSize: {
				width: 1000,
				height: 600
			},
			cropInfo: {
				width: 500,
				minRatioX: 1,
				minRatioY: 2,
				maxRatioX: 2,
				maxRatioY: 1
			}
		},
		expected: {
			doCrop: false,
			doResize: true,
			scaledWidth: 500,
			scaledHeight: 300,
			tooSmall: false
		}
	},
	{
		name: "Image Aspect ratio is same as minRatio - no cropping",
		input: {
			imageSize: {
				width: 600,
				height: 1000
			},
			cropInfo: {
				width: 500,
				minRatioX: 600,
				minRatioY: 1000,
				maxRatioX: 1000,
				maxRatioY: 600
			}
		},
		expected: {
			doCrop: false,
			doResize: true,
			scaledWidth: 500,
			scaledHeight: 833,
			tooSmall: false
		}
	},
	{
		name: "Image Aspect ratio is same as maxRatio - no cropping",
		input: {
			imageSize: {
				width: 1000,
				height: 600
			},
			cropInfo: {
				width: 500,
				minRatioX: 600,
				minRatioY: 1000,
				maxRatioX: 1000,
				maxRatioY: 600
			}
		},
		expected: {
			doCrop: false,
			doResize: true,
			scaledWidth: 500,
			scaledHeight: 300,
			tooSmall: false
		}
	},
	{
		name: "Off-center focal point moves cropping proportionally",
		input: {
			imageSize: {
				width: 1000,
				height: 1000
			},
			cropInfo: {
				width: 500,
				minRatioX: 3,
				minRatioY: 2,
				maxRatioX: 3,
				maxRatioY: 2
			},
			focalPoint: {
				fx: 33,
				fy: 33
			}
		},
		expected: {
			doCrop: true,
			xPos: 0,
			yPos: 110,
			cropWidth: 1000,
			cropHeight: 667,
			doResize: true,
			scaledWidth: 500,
			scaledHeight: 333,
			tooSmall: false
		}
	},
	{
		name: "Off-center focal point moves cropping proportionally",
		input: {
			imageSize: {
				width: 1000,
				height: 1000
			},
			cropInfo: {
				width: 500,
				minRatioX: 2,
				minRatioY: 3,
				maxRatioX: 2,
				maxRatioY: 3
			},
			focalPoint: {
				fx: 25,
				fy: 25
			}
		},
		expected: {
			doCrop: true,
			xPos: 83,
			yPos: 0,
			cropWidth: 667,
			cropHeight: 1000,
			doResize: true,
			scaledWidth: 500,
			scaledHeight: 750,
			tooSmall: false
		}
	},
	{
		name: "Original image is too narrow to fully match aspect ratio after scaling",
		input: {
			imageSize: {
				width: 500,
				height: 1000
			},
			cropInfo: {
				height: 500,
				minRatioX: 2,
				minRatioY: 1,
				maxRatioX: 2,
				maxRatioY: 1
			}
		},
		expected: {
			doCrop: true,
			xPos: 0,
			yPos: 250,
			cropWidth: 500,
			cropHeight: 500,
			doResize: false,
			tooSmall: true,
			targetWidth: 1000,
			targetHeight: 500
		}
	},
	{
		name: "Off-size bounding-box defines scaling results",
		input: {
			imageSize: {
				width: 800,
				height: 1000
			},
			cropInfo: {
				width: 1000,
				height: 300,
				minRatioX: 2,
				minRatioY: 1,
				maxRatioX: 2,
				maxRatioY: 1
			}
		},
		expected: {
			doCrop: true,
			xPos: 0,
			yPos: 300,
			cropWidth: 800,
			cropHeight: 400,
			doResize: true,
			scaledWidth: 600,
			scaledHeight: 300,
			tooSmall: false
		}
	},
	{
		name: "Original image is too narrow for cropping",
		input: {
			imageSize: {
				width: 500,
				height: 1000
			},
			cropInfo: {
				height: 1000,
				minRatioX: 2,
				minRatioY: 1,
				maxRatioX: 2,
				maxRatioY: 1
			}
		},
		expected: {
			doResize: false,
			doCrop: false,
			tooSmall: true,
			targetWidth: 2000,
			targetHeight: 1000
		}
	},
	{
		name: "Original image is too small for cropping",
		input: {
			imageSize: {
				width: 500,
				height: 1000
			},
			cropInfo: {
				height: 1200,
				minRatioX: 2,
				minRatioY: 1,
				maxRatioX: 2,
				maxRatioY: 1
			}
		},
		expected: {
			doResize: false,
			doCrop: false,
			tooSmall: true,
			targetWidth: 2400,
			targetHeight: 1200
		}
	},
	{
		name: "Defined rectangle that fits within crop result has no effect (without snapTo parameter)",
		input: {
			imageSize: {
				width: 1000,
				height: 800
			},
			cropInfo: {
				width: 500,
				minRatioX: 2,
				minRatioY: 1,
				maxRatioX: 2,
				maxRatioY: 1
			},
			focalPoint: {
				fx: 25,
				fy: 25,
				r1x: 15,
				r1y: 15,
				r2x: 30,
				r2y: 30
			}
		},
		expected: {
			doCrop: true,
			xPos: 0,
			yPos: 75,
			cropWidth: 1000,
			cropHeight: 500,
			doResize: true,
			scaledWidth: 500,
			scaledHeight: 250,
			tooSmall: false
		}
	},
	{
		name: "Defined rectangle DOES shift the cropping area (without snapTo).",
		input: {
			imageSize: {
				width: 1000,
				height: 800
			},
			cropInfo: {
				width: 500,
				minRatioX: 2,
				minRatioY: 1,
				maxRatioX: 2,
				maxRatioY: 1
			},
			focalPoint: {
				fx: 25,
				fy: 25,
				r1x: 0,
				r1y: 0,
				r2x: 30,
				r2y: 30
			}
		},
		expected: {
			doCrop: true,
			xPos: 0,
			yPos: 0,
			cropWidth: 1000,
			cropHeight: 500,
			doResize: true,
			scaledWidth: 500,
			scaledHeight: 250,
			tooSmall: false
		}
	},
	{
		name: "Defined rectangle also shifts cropping down (without snapTo).",
		input: {
			imageSize: {
				width: 1000,
				height: 800
			},
			cropInfo: {
				width: 500,
				minRatioX: 2,
				minRatioY: 1,
				maxRatioX: 2,
				maxRatioY: 1
			},
			focalPoint: {
				fx: 75,
				fy: 75,
				r1x: 70,
				r1y: 70,
				r2x: 100,
				r2y: 100
			}
		},
		expected: {
			doCrop: true,
			xPos: 0,
			yPos: 300,
			cropWidth: 1000,
			cropHeight: 500,
			doResize: true,
			scaledWidth: 500,
			scaledHeight: 250,
			tooSmall: false
		}
	},
	{
		name: "Defined rectangle also shifts cropping right (without snapTo).",
		input: {
			imageSize: {
				width: 1000,
				height: 800
			},
			cropInfo: {
				height: 400,
				minRatioX: 1,
				minRatioY: 2,
				maxRatioX: 1,
				maxRatioY: 2
			},
			focalPoint: {
				fx: 75,
				fy: 75,
				r1x: 70,
				r1y: 70,
				r2x: 100,
				r2y: 100
			}
		},
		expected: {
			doCrop: true,
			xPos: 600,
			yPos: 0,
			cropWidth: 400,
			cropHeight: 800,
			doResize: true,
			scaledWidth: 200,
			scaledHeight: 400,
			tooSmall: false
		}
	},
	{
		name: "Focal point influences rectangle shifting (not here though, reference case)",
		input: {
			imageSize: {
				width: 1000,
				height: 800
			},
			cropInfo: {
				height: 400,
				minRatioX: 1,
				minRatioY: 2,
				maxRatioX: 1,
				maxRatioY: 2
			},
			focalPoint: {
				fx: 50,
				fy: 50,
				r1x: 10,
				r1y: 10,
				r2x: 90,
				r2y: 90
			}
		},
		expected: {
			doCrop: true,
			xPos: 300,
			yPos: 0,
			cropWidth: 400,
			cropHeight: 800,
			doResize: true,
			scaledWidth: 200,
			scaledHeight: 400,
			tooSmall: false
		}
	},
	{
		name: "Focal point influences rectangle shifting (to the left)",
		input: {
			imageSize: {
				width: 1000,
				height: 800
			},
			cropInfo: {
				height: 400,
				minRatioX: 1,
				minRatioY: 2,
				maxRatioX: 1,
				maxRatioY: 2
			},
			focalPoint: {
				fx: 10,
				fy: 10,
				r1x: 10,
				r1y: 10,
				r2x: 90,
				r2y: 90
			}
		},
		expected: {
			doCrop: true,
			xPos: 100,
			yPos: 0,
			cropWidth: 400,
			cropHeight: 800,
			doResize: true,
			scaledWidth: 200,
			scaledHeight: 400,
			tooSmall: false
		}
	},
	{
		name: "Focal point influences rectangle shifting (to the right)",
		input: {
			imageSize: {
				width: 1000,
				height: 800
			},
			cropInfo: {
				height: 400,
				minRatioX: 1,
				minRatioY: 2,
				maxRatioX: 1,
				maxRatioY: 2
			},
			focalPoint: {
				fx: 90,
				fy: 90,
				r1x: 10,
				r1y: 10,
				r2x: 90,
				r2y: 90
			}
		},
		expected: {
			doCrop: true,
			xPos: 500,
			yPos: 0,
			cropWidth: 400,
			cropHeight: 800,
			doResize: true,
			scaledWidth: 200,
			scaledHeight: 400,
			tooSmall: false
		}
	},
	{
		name: "Focal point influences rectangle shifting (up)",
		input: {
			imageSize: {
				width: 1000,
				height: 800
			},
			cropInfo: {
				width: 500,
				minRatioX: 2,
				minRatioY: 1,
				maxRatioX: 2,
				maxRatioY: 1
			},
			focalPoint: {
				fx: 10,
				fy: 10,
				r1x: 10,
				r1y: 10,
				r2x: 90,
				r2y: 90
			}
		},
		expected: {
			doCrop: true,
			xPos: 0,
			yPos: 80,
			cropWidth: 1000,
			cropHeight: 500,
			doResize: true,
			scaledWidth: 500,
			scaledHeight: 250,
			tooSmall: false
		}
	},
	{
		name: "Focal point influences rectangle shifting (down)",
		input: {
			imageSize: {
				width: 1000,
				height: 800
			},
			cropInfo: {
				width: 500,
				minRatioX: 2,
				minRatioY: 1,
				maxRatioX: 2,
				maxRatioY: 1
			},
			focalPoint: {
				fx: 90,
				fy: 90,
				r1x: 10,
				r1y: 10,
				r2x: 90,
				r2y: 90
			}
		},
		expected: {
			doCrop: true,
			xPos: 0,
			yPos: 220,
			cropWidth: 1000,
			cropHeight: 500,
			doResize: true,
			scaledWidth: 500,
			scaledHeight: 250,
			tooSmall: false
		}
	},
	{
		name: "Defined rectangle does not affect ratio (here without snapTo).",
		input: {
			imageSize: {
				width: 1000,
				height: 800
			},
			cropInfo: {
				width: 500,
				minRatioX: 2,
				minRatioY: 1,
				maxRatioX: 2,
				maxRatioY: 1
			},
			focalPoint: {
				fx: 75,
				fy: 75,
				r1x: 10,
				r1y: 10,
				r2x: 100,
				r2y: 100
			}
		},
		expected: {
			doCrop: true,
			xPos: 0,
			yPos: 239,
			cropWidth: 1000,
			cropHeight: 500,
			doResize: true,
			scaledWidth: 500,
			scaledHeight: 250,
			tooSmall: false
		}
	},
	{
		name: "Simple 150% zoom",
		input: {
			imageSize: {
				width: 1000,
				height: 500
			},
			cropInfo: {
				width: 500,
				zoom: 150
			},
			focalPoint: {
				fx: 50,
				fy: 50
			}
		},
		expected: {
			doCrop: true,
			xPos: 167,
			yPos: 83,
			cropWidth: 667,
			cropHeight: 333,
			doResize: true,
			scaledWidth: 500,
			scaledHeight: 250,
			tooSmall: false
		}
	},
	{
		name: "Zoom follows focal point around",
		input: {
			imageSize: {
				width: 1000,
				height: 500
			},
			cropInfo: {
				width: 500,
				zoom: 150
			},
			focalPoint: {
				fx: 25,
				fy: 75
			}
		},
		expected: {
			doCrop: true,
			xPos: 83,
			yPos: 125,
			cropWidth: 667,
			cropHeight: 333,
			doResize: true,
			scaledWidth: 500,
			scaledHeight: 250,
			tooSmall: false
		}
	},
	{
		name: "Focal point should default to center of image while zooming",
		input: {
			imageSize: {
				width: 1000,
				height: 500
			},
			cropInfo: {
				width: 500,
				zoom: 150
			}
		},
		expected: {
			doCrop: true,
			xPos: 167,
			yPos: 83,
			cropWidth: 667,
			cropHeight: 333,
			doResize: true,
			scaledWidth: 500,
			scaledHeight: 250,
			tooSmall: false
		}
	},
	{
		name: "Zoom is limited by original image size",
		input: {
			imageSize: {
				width: 1000,
				height: 500
			},
			cropInfo: {
				width: 700,
				zoom: 250
			},
			focalPoint: {
				fx: 50,
				fy: 50
			}
		},
		expected: {
			doCrop: true,
			xPos: 150,
			yPos: 75,
			cropWidth: 700,
			cropHeight: 350,
			doResize: false,
			tooSmall: false
		}
	},
	{
		name: "Zoom is limited by original image size",
		input: {
			imageSize: {
				width: 1000,
				height: 500
			},
			cropInfo: {
				height: 350,
				zoom: 200
			}
		},
		expected: {
			doCrop: true,
			xPos: 150,
			yPos: 75,
			cropWidth: 700,
			cropHeight: 350,
			doResize: false,
			tooSmall: false
		}
	},
	{
		name: "Zoom is limited by original image size",
		input: {
			imageSize: {
				width: 1000,
				height: 500
			},
			cropInfo: {
				width: 700,
				height: 450,
				zoom: 250
			}
		},
		expected: {
			doCrop: true,
			xPos: 150,
			yPos: 75,
			cropWidth: 700,
			cropHeight: 350,
			doResize: false,
			tooSmall: false
		}
	},
	{
		name: "Zoom is limited by original image size",
		input: {
			imageSize: {
				width: 1000,
				height: 500
			},
			cropInfo: {
				width: 1000,
				zoom: 250
			}
		},
		expected: {
			doCrop: false,
			doResize: false,
			tooSmall: false
		}
	},
	{
		name: "Zoom is limited by original image size",
		input: {
			imageSize: {
				width: 1000,
				height: 500
			},
			cropInfo: {
				width: 1000,
				height: 1000,
				zoom: 250
			}
		},
		expected: {
			doCrop: false,
			doResize: false,
			tooSmall: false
		}
	},
	{
		name: "Combination of rectangle+snapTo (zoom-box) overrides any zoom level value",
		input: {
			imageSize: {
				width: 1000,
				height: 500
			},
			cropInfo: {
				width: 300,
				zoom: 100,
				snapTo: true
			},
			focalPoint: {
				fx: 40,
				fy: 30,
				r1x: 20,
				r1y: 10,
				r2x: 60,
				r2y: 50
			}
		},
		expected: {
			doCrop: true,
			xPos: 200,
			yPos: 50,
			cropWidth: 400,
			cropHeight: 200,
			doResize: true,
			scaledWidth: 300,
			scaledHeight: 150,
			tooSmall: false
		}
	},
	{
		name: "Defined rectangle (without snapTo) limits zoom level value",
		input: {
			imageSize: {
				width: 1000,
				height: 1000
			},
			cropInfo: {
				width: 250,
				zoom: 500
			},
			focalPoint: {
				fx: 50,
				fy: 50,
				r1x: 10,
				r1y: 10,
				r2x: 90,
				r2y: 90
			}
		},
		expected: {
			doCrop: true,
			xPos: 100,
			yPos: 100,
			cropWidth: 800,
			cropHeight: 800,
			doResize: true,
			scaledWidth: 250,
			scaledHeight: 250,
			tooSmall: false
		}
	},
	{
		name: "Defined rectangle (without snapTo) limits zoom level value but respects cropping and doesn't cause rattling!!!!!!1°",
		input: {
			imageSize: {
				width: 1000,
				height: 1000
			},
			cropInfo: {
				width: 250,
				zoom: 500,
				minRatioX: 2,
				minRatioY: 1,
				maxRatioX: 2,
				maxRatioY: 1
			},
			focalPoint: {
				fx: 50,
				fy: 50,
				r1x: 10,
				r1y: 10,
				r2x: 90,
				r2y: 90
			}
		},
		expected: {
			doCrop: true,
			xPos: 0,
			yPos: 250,
			cropWidth: 1000,
			cropHeight: 500,
			doResize: true,
			scaledWidth: 250,
			scaledHeight: 125,
			tooSmall: false
		}
	},
	{
		name: "Defined rectangle (without snapTo) limits zoom level value but respects cropping and doesn't cause rattling!!!!!!1° and also respects the focal point",
		input: {
			imageSize: {
				width: 1000,
				height: 1000
			},
			cropInfo: {
				width: 250,
				zoom: 500,
				minRatioX: 2,
				minRatioY: 1,
				maxRatioX: 2,
				maxRatioY: 1
			},
			focalPoint: {
				fx: 50,
				fy: 15,
				r1x: 10,
				r1y: 10,
				r2x: 90,
				r2y: 90
			}
		},
		expected: {
			doCrop: true,
			xPos: 0,
			yPos: 119,
			cropWidth: 1000,
			cropHeight: 500,
			doResize: true,
			scaledWidth: 250,
			scaledHeight: 125,
			tooSmall: false
		}
	},
	{
		name: "Combination of rectangle+snapTo (zoom-box) initiates zooming",
		input: {
			imageSize: {
				width: 1000,
				height: 500
			},
			cropInfo: {
				width: 300,
				snapTo: true
			},
			focalPoint: {
				fx: 40,
				fy: 30,
				r1x: 20,
				r1y: 10,
				r2x: 60,
				r2y: 50
			}
		},
		expected: {
			doCrop: true,
			xPos: 200,
			yPos: 50,
			cropWidth: 400,
			cropHeight: 200,
			doResize: true,
			scaledWidth: 300,
			scaledHeight: 150,
			tooSmall: false
		}
	},
	{
		name: "Rectangle+snapTo overrides any zoom level value",
		input: {
			imageSize: {
				width: 1000,
				height: 500
			},
			cropInfo: {
				width: 300,
				zoom: 500,
				snapTo: true
			},
			focalPoint: {
				fx: 40,
				fy: 30,
				r1x: 20,
				r1y: 10,
				r2x: 60,
				r2y: 50
			}
		},
		expected: {
			doCrop: true,
			xPos: 200,
			yPos: 50,
			cropWidth: 400,
			cropHeight: 200,
			doResize: true,
			scaledWidth: 300,
			scaledHeight: 150,
			tooSmall: false
		}
	},
	{
		name: "Rectangle+snapTo overrides any zoom level value (while maintaining original aspect ratio)",
		input: {
			imageSize: {
				width: 1000,
				height: 500
			},
			cropInfo: {
				width: 300,
				zoom: 100,
				snapTo: true
			},
			focalPoint: {
				fx: 40,
				fy: 30,
				r1x: 30,
				r1y: 10,
				r2x: 50,
				r2y: 50
			}
		},
		expected: {
			doCrop: true,
			xPos: 240,
			yPos: 50,
			cropWidth: 400,
			cropHeight: 200,
			doResize: true,
			scaledWidth: 300,
			scaledHeight: 150,
			tooSmall: false
		}
	},
	{
		name: "Rectangle (without snapTo) contained after zoom does not override zoom level value",
		input: {
			imageSize: {
				width: 1000,
				height: 500
			},
			cropInfo: {
				width: 300,
				zoom: 100
			},
			focalPoint: {
				fx: 40,
				fy: 30,
				r1x: 30,
				r1y: 10,
				r2x: 50,
				r2y: 50
			}
		},
		expected: {
			doCrop: false,
			doResize: true,
			scaledWidth: 300,
			scaledHeight: 150,
			tooSmall: false
		}
	},
	{
		name: "Focal point position relative to rectangle+snapTo affects crop-box-position",
		input: {
			imageSize: {
				width: 1000,
				height: 500
			},
			cropInfo: {
				width: 300,
				snapTo: true
			},
			focalPoint: {
				fx: 35,
				fy: 20,
				r1x: 30,
				r1y: 10,
				r2x: 50,
				r2y: 50
			}
		},
		expected: {
			doCrop: true,
			xPos: 210,
			yPos: 50,
			cropWidth: 400,
			cropHeight: 200,
			doResize: true,
			scaledWidth: 300,
			scaledHeight: 150,
			tooSmall: false
		}
	},
	{
		name: "Rectangle+snapTo (zoom-box boundries) interacts with focal-point",
		input: {
			imageSize: {
				width: 1000,
				height: 1000
			},
			cropInfo: {
				height: 300,
				snapTo: true
			},
			focalPoint: {
				fx: 40,
				fy: 40,
				r1x: 5,
				r1y: 20,
				r2x: 40,
				r2y: 60
			}
		},
		expected: {
			doCrop: true,
			xPos: 50,
			yPos: 200,
			cropWidth: 400,
			cropHeight: 400,
			doResize: true,
			scaledWidth: 300,
			scaledHeight: 300,
			tooSmall: false
		}
	},
	{
		name: "Zooming towards 'zoom-box' is limited by size of the original image",
		input: {
			imageSize: {
				width: 1000,
				height: 500
			},
			cropInfo: {
				width: 800,
				zoom: 500,
				snapTo: true
			},
			focalPoint: {
				fx: 40,
				fy: 30,
				r1x: 30,
				r1y: 10,
				r2x: 50,
				r2y: 50
			}
		},
		expected: {
			doCrop: true,
			xPos: 80,
			yPos: 30,
			cropWidth: 800,
			cropHeight: 400,
			doResize: false,
			tooSmall: false
		}
	},
	{
		name: "Zooming towards 'zoom-box' is limited by size of the original image",
		input: {
			imageSize: {
				width: 1000,
				height: 500
			},
			cropInfo: {
				width: 1000,
				zoom: 500
			},
			focalPoint: {
				fx: 40,
				fy: 30,
				r1x: 30,
				r1y: 10,
				r2x: 50,
				r2y: 50
			}
		},
		expected: {
			doCrop: false,
			doResize: false,
			tooSmall: false
		}
	},
	{
		name: "Zooming combines nicely with aspect-ratio",
		input: {
			imageSize: {
				width: 1000,
				height: 1000
			},
			cropInfo: {
				width: 300,
				zoom: 200,
				minRatioX: 2,
				minRatioY: 1,
				maxRatioX: 2,
				maxRatioY: 1
			}
		},
		expected: {
			doCrop: true,
			xPos: 250,
			yPos: 375,
			cropWidth: 500,
			cropHeight: 250,
			doResize: true,
			scaledWidth: 300,
			scaledHeight: 150,
			tooSmall: false
		}
	},
	{
		name: "Zooming combines nicely with aspect-ratio and focal-point",
		input: {
			imageSize: {
				width: 1000,
				height: 1000
			},
			cropInfo: {
				width: 300,
				zoom: 200,
				minRatioX: 2,
				minRatioY: 1,
				maxRatioX: 2,
				maxRatioY: 1
			},
			focalPoint: {
				fx: 25,
				fy: 75
			}
		},
		expected: {
			doCrop: true,
			xPos: 125,
			yPos: 563,
			cropWidth: 500,
			cropHeight: 250,
			doResize: true,
			scaledWidth: 300,
			scaledHeight: 150,
			tooSmall: false
		}
	},
	{
		name: "Aspect ratio and original image size limit zooming",
		input: {
			imageSize: {
				width: 1000,
				height: 1000
			},
			cropInfo: {
				width: 800,
				zoom: 200,
				minRatioX: 2,
				minRatioY: 1,
				maxRatioX: 2,
				maxRatioY: 1
			}
		},
		expected: {
			doCrop: true,
			xPos: 100,
			yPos: 300,
			cropWidth: 800,
			cropHeight: 400,
			doResize: false,
			tooSmall: false
		}
	},
	{
		name: "Aspect ratio and original image size limit zooming",
		input: {
			imageSize: {
				width: 1000,
				height: 1000
			},
			cropInfo: {
				height: 800,
				zoom: 200,
				minRatioX: 1,
				minRatioY: 2,
				maxRatioX: 1,
				maxRatioY: 2
			}
		},
		expected: {
			doCrop: true,
			xPos: 300,
			yPos: 100,
			cropWidth: 400,
			cropHeight: 800,
			doResize: false,
			tooSmall: false
		}
	},
	{
		name: "Rectangle+snapTo (zoom box) combines nicely with aspect-ratio",
		input: {
			imageSize: {
				width: 1000,
				height: 1000
			},
			cropInfo: {
				height: 300,
				zoom: 100,
				minRatioX: 2,
				minRatioY: 1,
				maxRatioX: 2,
				maxRatioY: 1,
				snapTo: true
			},
			focalPoint: {
				fx: 40,
				fy: 40,
				r1x: 5,
				r1y: 20,
				r2x: 40,
				r2y: 60
			}
		},
		expected: {
			doCrop: true,
			xPos: 50,
			yPos: 200,
			cropWidth: 800,
			cropHeight: 400,
			doResize: true,
			scaledWidth: 600,
			scaledHeight: 300,
			tooSmall: false
		}
	},
	{
		name: "Rectangle (without snapTo) does not interfere with zoom and aspect-ratio",
		input: {
			imageSize: {
				width: 1000,
				height: 1000
			},
			cropInfo: {
				height: 300,
				zoom: 100,
				minRatioX: 2,
				minRatioY: 1,
				maxRatioX: 2,
				maxRatioY: 1
			},
			focalPoint: {
				fx: 40,
				fy: 40,
				r1x: 5,
				r1y: 20,
				r2x: 40,
				r2y: 60
			}
		},
		expected: {
			doCrop: true,
			xPos: 0,
			yPos: 200,
			cropWidth: 1000,
			cropHeight: 500,
			doResize: true,
			scaledWidth: 600,
			scaledHeight: 300,
			tooSmall: false
		}
	},
	{
		name: "Aspect ratio cropping trumps Rectangle+snapTo",
		input: {
			imageSize: {
				width: 1000,
				height: 1000
			},
			cropInfo: {
				width: 500,
				zoom: 200,
				minRatioX: 2,
				minRatioY: 1,
				maxRatioX: 2,
				maxRatioY: 1,
				snapTo: true
			},
			focalPoint: {
				fx: 40,
				fy: 30,
				r1x: 30,
				r1y: 10,
				r2x: 50,
				r2y: 90
			}
		},
		expected: {
			doCrop: true,
			xPos: 0,
			yPos: 175,
			cropWidth: 1000,
			cropHeight: 500,
			doResize: true,
			scaledWidth: 500,
			scaledHeight: 250,
			tooSmall: false
		}
	},
	{
		name: "Aspect ratio cropping trumps Rectangle+snapTo - vertical",
		input: {
			imageSize: {
				width: 1000,
				height: 1000
			},
			cropInfo: {
				height: 500,
				zoom: 200,
				minRatioX: 1,
				minRatioY: 2,
				maxRatioX: 1,
				maxRatioY: 2,
				snapTo: true
			},
			focalPoint: {
				fx: 40,
				fy: 30,
				r1x: 6,
				r1y: 30,
				r2x: 86,
				r2y: 50
			}
		},
		expected: {
			doCrop: true,
			xPos: 188,
			yPos: 0,
			cropWidth: 500,
			cropHeight: 1000,
			doResize: true,
			scaledWidth: 250,
			scaledHeight: 500,
			tooSmall: false
		}
	},
	{
		name: "Original image size trumps both zoom-box and crop aspect-ratio",
		input: {
			imageSize: {
				width: 1000,
				height: 1000
			},
			cropInfo: {
				height: 1000,
				zoom: 200,
				minRatioX: 2,
				minRatioY: 1,
				maxRatioX: 2,
				maxRatioY: 1
			},
			focalPoint: {
				fx: 40,
				fy: 30,
				r1x: 10,
				r1y: 30,
				r2x: 90,
				r2y: 50
			}
		},
		expected: {
			doCrop: false,
			doResize: false,
			tooSmall: true,
			targetWidth: 2000,
			targetHeight: 1000
		}
	},
	{
		name: "Original image resolution limits the 'snap-to' zoom level",
		comments: " imageRatio: 1,50132625994695 ",
		input: {
			imageSize: {
				width: 1698,
				height: 1131
			},
			cropInfo: {
				width: 400,
				height: 400,
				snapTo: true
			},
			focalPoint: {
				fx: 50,
				fy: 50,
				r1x: 45,
				r1y: 45,
				r2x: 55,
				r2y: 55
			}
		},
		expected: {
			doCrop: true,
			doResize: false,
			tooSmall: false,
			xPos: 649,
			yPos: 432,
			cropWidth: 400,
			cropHeight: 266
		}
	},
	{
		name: "Test test",
		input: {
			imageSize: {
				width: 718,
				height: 120
			},
			cropInfo: {
				width: 400,
				height: 400,
				zoom: 250,
				minRatioX: 3,
				minRatioY: 4,
				maxRatioX: 3,
				maxRatioY: 4
			}
		},
		expected: {
			doCrop: true,
			doResize: false,
			tooSmall: true,
			targetWidth: 300,
			targetHeight: 400,
			cropWidth: 300,
			cropHeight: 120,
			xPos: 209,
			yPos: 0
		}
	},
	{
		name: "Image too small in one dimension",
		input: {
			imageSize: {
				width: 670,
				height: 292
			},
			cropInfo: {
				width: 300,
				height: 900,
				minRatioX: 1,
				minRatioY: 4.5,
				maxRatioX: 1,
				maxRatioY: 4.5
			}
		},
		expected: {
			doCrop: true,
			doResize: false,
			tooSmall: true,
			targetWidth: 200,
			targetHeight: 900,
			cropWidth: 200,
			cropHeight: 292,
			xPos: 235,
			yPos: 0
		}
	},
	{
		dolog: false,
		name: "Image too small in one dimension - one scaleTo undefined - nozoom",
		input: {
			imageSize: {
				width: 670,
				height: 292
			},
			cropInfo: {
				height: 900,
				minRatioX: 1,
				minRatioY: 4.5,
				maxRatioX: 1,
				maxRatioY: 4.5
			}
		},
		expected: {
			doCrop: true,
			doResize: false,
			tooSmall: true,
			targetWidth: 200,
			targetHeight: 900,
			cropWidth: 200,
			cropHeight: 292,
			xPos: 235,
			yPos: 0
		}
	},
	{
		dolog: false,
		name: "Image too small in one dimension - one scaleTo undefined - nozoom - rotated",
		input: {
			imageSize: {
				width: 292,
				height: 670
			},
			cropInfo: {
				width: 900,
				minRatioX: 4.5,
				minRatioY: 1,
				maxRatioX: 4.5,
				maxRatioY: 1
			}
		},
		expected: {
			doCrop: true,
			doResize: false,
			tooSmall: true,
			targetWidth: 900,
			targetHeight: 200,
			cropWidth: 292,
			cropHeight: 200,
			xPos: 0,
			yPos: 235
		}
	},
	{
		dolog: false,
		name: "Image too small in one dimension - one scaleTo undefined",
		input: {
			imageSize: {
				width: 670,
				height: 292
			},
			cropInfo: {
				height: 900,
				zoom: 250,
				minRatioX: 1,
				minRatioY: 4.5,
				maxRatioX: 1,
				maxRatioY: 4.5
			}
		},
		expected: {
			doCrop: true,
			doResize: false,
			tooSmall: true,
			targetWidth: 200,
			targetHeight: 900,
			cropWidth: 200,
			cropHeight: 292,
			xPos: 235,
			yPos: 0
		}
	},
	{
		dolog: false,
		name: "Image too small in one dimension - one scaleTo undefined - rotated",
		input: {
			imageSize: {
				width: 292,
				height: 670
			},
			cropInfo: {
				width: 900,
				zoom: 250,
				minRatioX: 4.5,
				minRatioY: 1,
				maxRatioX: 4.5,
				maxRatioY: 1
			}
		},
		expected: {
			doCrop: true,
			doResize: false,
			tooSmall: true,
			targetWidth: 900,
			targetHeight: 200,
			cropWidth: 292,
			cropHeight: 200,
			xPos: 0,
			yPos: 235
		}
	},
	{
		dolog: false,
		name: "focalArea extends over 98% of image - with snapTo",
		input: {
			imageSize: {
				width: 1920,
				height: 688
			},
			cropInfo: {
				width: 200,
				height: 200,
				snapTo: true,
				minRatioX: 1,
				minRatioY: 1,
				maxRatioX: 1,
				maxRatioY: 1
			},
			focalPoint: {
				fx: 50,
				fy: 40,
				r1x: 1,
				r1y: 0,
				r2x: 99,
				r2y: 80
			}
		},
		expected: {
			doCrop: true,
			doResize: true,
			tooSmall: false,
			cropWidth: 688,
			cropHeight: 688,
			xPos: 616,
			yPos: 0,
			scaledWidth: 200,
			scaledHeight: 200
		}
	},
	{
		dolog: false,
		name: "focalArea extends over 100% of image - with snapTo",
		input: {
			imageSize: {
				width: 1920,
				height: 688
			},
			cropInfo: {
				width: 200,
				height: 200,
				snapTo: true,
				minRatioX: 1,
				minRatioY: 1,
				maxRatioX: 1,
				maxRatioY: 1
			},
			focalPoint: {
				fx: 25,
				fy: 40,
				r1x: 0,
				r1y: 0,
				r2x: 100,
				r2y: 80
			}
		},
		expected: {
			doCrop: true,
			doResize: true,
			tooSmall: false,
			cropWidth: 688,
			cropHeight: 688,
			xPos: 308,
			yPos: 0,
			scaledWidth: 200,
			scaledHeight: 200
		}
	}
];

ospec.spec('getCleverCropBox()', function () {
  assertions.forEach(function (ref, i) {
		var name = ref.name;
		var input = ref.input;
		var expected = ref.expected;

		var imageSize = input.imageSize;
		var cropInfo = input.cropInfo;
		var focalPoint = input.focalPoint;
    ospec(name + ' -- "' + JSON.stringify(input) + '"', function () {
      ospec(getCleverCropBox(imageSize, cropInfo, focalPoint)).deepEquals(expected);
    });
  });
});
