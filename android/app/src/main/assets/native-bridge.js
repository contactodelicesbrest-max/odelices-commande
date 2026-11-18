/* native-bridge Capacitor converti pour anciens WebView */
/**
 * Copyright (c) 2014-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

var runtime = (function (exports) {
  "use strict";

  var Op = Object.prototype;
  var hasOwn = Op.hasOwnProperty;
  var defineProperty = Object.defineProperty || function (obj, key, desc) { obj[key] = desc.value; };
  var undefined; // More compressible than void 0.
  var $Symbol = typeof Symbol === "function" ? Symbol : {};
  var iteratorSymbol = $Symbol.iterator || "@@iterator";
  var asyncIteratorSymbol = $Symbol.asyncIterator || "@@asyncIterator";
  var toStringTagSymbol = $Symbol.toStringTag || "@@toStringTag";

  function define(obj, key, value) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
    return obj[key];
  }
  try {
    // IE 8 has a broken Object.defineProperty that only works on DOM objects.
    define({}, "");
  } catch (err) {
    define = function(obj, key, value) {
      return obj[key] = value;
    };
  }

  function wrap(innerFn, outerFn, self, tryLocsList) {
    // If outerFn provided and outerFn.prototype is a Generator, then outerFn.prototype instanceof Generator.
    var protoGenerator = outerFn && outerFn.prototype instanceof Generator ? outerFn : Generator;
    var generator = Object.create(protoGenerator.prototype);
    var context = new Context(tryLocsList || []);

    // The ._invoke method unifies the implementations of the .next,
    // .throw, and .return methods.
    defineProperty(generator, "_invoke", { value: makeInvokeMethod(innerFn, self, context) });

    return generator;
  }
  exports.wrap = wrap;

  // Try/catch helper to minimize deoptimizations. Returns a completion
  // record like context.tryEntries[i].completion. This interface could
  // have been (and was previously) designed to take a closure to be
  // invoked without arguments, but in all the cases we care about we
  // already have an existing method we want to call, so there's no need
  // to create a new function object. We can even get away with assuming
  // the method takes exactly one argument, since that happens to be true
  // in every case, so we don't have to touch the arguments object. The
  // only additional allocation required is the completion record, which
  // has a stable shape and so hopefully should be cheap to allocate.
  function tryCatch(fn, obj, arg) {
    try {
      return { type: "normal", arg: fn.call(obj, arg) };
    } catch (err) {
      return { type: "throw", arg: err };
    }
  }

  var GenStateSuspendedStart = "suspendedStart";
  var GenStateSuspendedYield = "suspendedYield";
  var GenStateExecuting = "executing";
  var GenStateCompleted = "completed";

  // Returning this object from the innerFn has the same effect as
  // breaking out of the dispatch switch statement.
  var ContinueSentinel = {};

  // Dummy constructor functions that we use as the .constructor and
  // .constructor.prototype properties for functions that return Generator
  // objects. For full spec compliance, you may wish to configure your
  // minifier not to mangle the names of these two functions.
  function Generator() {}
  function GeneratorFunction() {}
  function GeneratorFunctionPrototype() {}

  // This is a polyfill for %IteratorPrototype% for environments that
  // don't natively support it.
  var IteratorPrototype = {};
  define(IteratorPrototype, iteratorSymbol, function () {
    return this;
  });

  var getProto = Object.getPrototypeOf;
  var NativeIteratorPrototype = getProto && getProto(getProto(values([])));
  if (NativeIteratorPrototype &&
      NativeIteratorPrototype !== Op &&
      hasOwn.call(NativeIteratorPrototype, iteratorSymbol)) {
    // This environment has a native %IteratorPrototype%; use it instead
    // of the polyfill.
    IteratorPrototype = NativeIteratorPrototype;
  }

  var Gp = GeneratorFunctionPrototype.prototype =
    Generator.prototype = Object.create(IteratorPrototype);
  GeneratorFunction.prototype = GeneratorFunctionPrototype;
  defineProperty(Gp, "constructor", { value: GeneratorFunctionPrototype, configurable: true });
  defineProperty(
    GeneratorFunctionPrototype,
    "constructor",
    { value: GeneratorFunction, configurable: true }
  );
  GeneratorFunction.displayName = define(
    GeneratorFunctionPrototype,
    toStringTagSymbol,
    "GeneratorFunction"
  );

  // Helper for defining the .next, .throw, and .return methods of the
  // Iterator interface in terms of a single ._invoke method.
  function defineIteratorMethods(prototype) {
    ["next", "throw", "return"].forEach(function(method) {
      define(prototype, method, function(arg) {
        return this._invoke(method, arg);
      });
    });
  }

  exports.isGeneratorFunction = function(genFun) {
    var ctor = typeof genFun === "function" && genFun.constructor;
    return ctor
      ? ctor === GeneratorFunction ||
        // For the native GeneratorFunction constructor, the best we can
        // do is to check its .name property.
        (ctor.displayName || ctor.name) === "GeneratorFunction"
      : false;
  };

  exports.mark = function(genFun) {
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(genFun, GeneratorFunctionPrototype);
    } else {
      genFun.__proto__ = GeneratorFunctionPrototype;
      define(genFun, toStringTagSymbol, "GeneratorFunction");
    }
    genFun.prototype = Object.create(Gp);
    return genFun;
  };

  // Within the body of any async function, `await x` is transformed to
  // `yield regeneratorRuntime.awrap(x)`, so that the runtime can test
  // `hasOwn.call(value, "__await")` to determine if the yielded value is
  // meant to be awaited.
  exports.awrap = function(arg) {
    return { __await: arg };
  };

  function AsyncIterator(generator, PromiseImpl) {
    function invoke(method, arg, resolve, reject) {
      var record = tryCatch(generator[method], generator, arg);
      if (record.type === "throw") {
        reject(record.arg);
      } else {
        var result = record.arg;
        var value = result.value;
        if (value &&
            typeof value === "object" &&
            hasOwn.call(value, "__await")) {
          return PromiseImpl.resolve(value.__await).then(function(value) {
            invoke("next", value, resolve, reject);
          }, function(err) {
            invoke("throw", err, resolve, reject);
          });
        }

        return PromiseImpl.resolve(value).then(function(unwrapped) {
          // When a yielded Promise is resolved, its final value becomes
          // the .value of the Promise<{value,done}> result for the
          // current iteration.
          result.value = unwrapped;
          resolve(result);
        }, function(error) {
          // If a rejected Promise was yielded, throw the rejection back
          // into the async generator function so it can be handled there.
          return invoke("throw", error, resolve, reject);
        });
      }
    }

    var previousPromise;

    function enqueue(method, arg) {
      function callInvokeWithMethodAndArg() {
        return new PromiseImpl(function(resolve, reject) {
          invoke(method, arg, resolve, reject);
        });
      }

      return previousPromise =
        // If enqueue has been called before, then we want to wait until
        // all previous Promises have been resolved before calling invoke,
        // so that results are always delivered in the correct order. If
        // enqueue has not been called before, then it is important to
        // call invoke immediately, without waiting on a callback to fire,
        // so that the async generator function has the opportunity to do
        // any necessary setup in a predictable way. This predictability
        // is why the Promise constructor synchronously invokes its
        // executor callback, and why async functions synchronously
        // execute code before the first await. Since we implement simple
        // async functions in terms of async generators, it is especially
        // important to get this right, even though it requires care.
        previousPromise ? previousPromise.then(
          callInvokeWithMethodAndArg,
          // Avoid propagating failures to Promises returned by later
          // invocations of the iterator.
          callInvokeWithMethodAndArg
        ) : callInvokeWithMethodAndArg();
    }

    // Define the unified helper method that is used to implement .next,
    // .throw, and .return (see defineIteratorMethods).
    defineProperty(this, "_invoke", { value: enqueue });
  }

  defineIteratorMethods(AsyncIterator.prototype);
  define(AsyncIterator.prototype, asyncIteratorSymbol, function () {
    return this;
  });
  exports.AsyncIterator = AsyncIterator;

  // Note that simple async functions are implemented on top of
  // AsyncIterator objects; they just return a Promise for the value of
  // the final result produced by the iterator.
  exports.async = function(innerFn, outerFn, self, tryLocsList, PromiseImpl) {
    if (PromiseImpl === void 0) PromiseImpl = Promise;

    var iter = new AsyncIterator(
      wrap(innerFn, outerFn, self, tryLocsList),
      PromiseImpl
    );

    return exports.isGeneratorFunction(outerFn)
      ? iter // If outerFn is a generator, return the full iterator.
      : iter.next().then(function(result) {
          return result.done ? result.value : iter.next();
        });
  };

  function makeInvokeMethod(innerFn, self, context) {
    var state = GenStateSuspendedStart;

    return function invoke(method, arg) {
      if (state === GenStateExecuting) {
        throw new Error("Generator is already running");
      }

      if (state === GenStateCompleted) {
        if (method === "throw") {
          throw arg;
        }

        // Be forgiving, per 25.3.3.3.3 of the spec:
        // https://people.mozilla.org/~jorendorff/es6-draft.html#sec-generatorresume
        return doneResult();
      }

      context.method = method;
      context.arg = arg;

      while (true) {
        var delegate = context.delegate;
        if (delegate) {
          var delegateResult = maybeInvokeDelegate(delegate, context);
          if (delegateResult) {
            if (delegateResult === ContinueSentinel) continue;
            return delegateResult;
          }
        }

        if (context.method === "next") {
          // Setting context._sent for legacy support of Babel's
          // function.sent implementation.
          context.sent = context._sent = context.arg;

        } else if (context.method === "throw") {
          if (state === GenStateSuspendedStart) {
            state = GenStateCompleted;
            throw context.arg;
          }

          context.dispatchException(context.arg);

        } else if (context.method === "return") {
          context.abrupt("return", context.arg);
        }

        state = GenStateExecuting;

        var record = tryCatch(innerFn, self, context);
        if (record.type === "normal") {
          // If an exception is thrown from innerFn, we leave state ===
          // GenStateExecuting and loop back for another invocation.
          state = context.done
            ? GenStateCompleted
            : GenStateSuspendedYield;

          if (record.arg === ContinueSentinel) {
            continue;
          }

          return {
            value: record.arg,
            done: context.done
          };

        } else if (record.type === "throw") {
          state = GenStateCompleted;
          // Dispatch the exception by looping back around to the
          // context.dispatchException(context.arg) call above.
          context.method = "throw";
          context.arg = record.arg;
        }
      }
    };
  }

  // Call delegate.iterator[context.method](context.arg) and handle the
  // result, either by returning a { value, done } result from the
  // delegate iterator, or by modifying context.method and context.arg,
  // setting context.delegate to null, and returning the ContinueSentinel.
  function maybeInvokeDelegate(delegate, context) {
    var methodName = context.method;
    var method = delegate.iterator[methodName];
    if (method === undefined) {
      // A .throw or .return when the delegate iterator has no .throw
      // method, or a missing .next mehtod, always terminate the
      // yield* loop.
      context.delegate = null;

      // Note: ["return"] must be used for ES3 parsing compatibility.
      if (methodName === "throw" && delegate.iterator["return"]) {
        // If the delegate iterator has a return method, give it a
        // chance to clean up.
        context.method = "return";
        context.arg = undefined;
        maybeInvokeDelegate(delegate, context);

        if (context.method === "throw") {
          // If maybeInvokeDelegate(context) changed context.method from
          // "return" to "throw", let that override the TypeError below.
          return ContinueSentinel;
        }
      }
      if (methodName !== "return") {
        context.method = "throw";
        context.arg = new TypeError(
          "The iterator does not provide a '" + methodName + "' method");
      }

      return ContinueSentinel;
    }

    var record = tryCatch(method, delegate.iterator, context.arg);

    if (record.type === "throw") {
      context.method = "throw";
      context.arg = record.arg;
      context.delegate = null;
      return ContinueSentinel;
    }

    var info = record.arg;

    if (! info) {
      context.method = "throw";
      context.arg = new TypeError("iterator result is not an object");
      context.delegate = null;
      return ContinueSentinel;
    }

    if (info.done) {
      // Assign the result of the finished delegate to the temporary
      // variable specified by delegate.resultName (see delegateYield).
      context[delegate.resultName] = info.value;

      // Resume execution at the desired location (see delegateYield).
      context.next = delegate.nextLoc;

      // If context.method was "throw" but the delegate handled the
      // exception, let the outer generator proceed normally. If
      // context.method was "next", forget context.arg since it has been
      // "consumed" by the delegate iterator. If context.method was
      // "return", allow the original .return call to continue in the
      // outer generator.
      if (context.method !== "return") {
        context.method = "next";
        context.arg = undefined;
      }

    } else {
      // Re-yield the result returned by the delegate method.
      return info;
    }

    // The delegate iterator is finished, so forget it and continue with
    // the outer generator.
    context.delegate = null;
    return ContinueSentinel;
  }

  // Define Generator.prototype.{next,throw,return} in terms of the
  // unified ._invoke helper method.
  defineIteratorMethods(Gp);

  define(Gp, toStringTagSymbol, "Generator");

  // A Generator should always return itself as the iterator object when the
  // @@iterator function is called on it. Some browsers' implementations of the
  // iterator prototype chain incorrectly implement this, causing the Generator
  // object to not be returned from this call. This ensures that doesn't happen.
  // See https://github.com/facebook/regenerator/issues/274 for more details.
  define(Gp, iteratorSymbol, function() {
    return this;
  });

  define(Gp, "toString", function() {
    return "[object Generator]";
  });

  function pushTryEntry(locs) {
    var entry = { tryLoc: locs[0] };

    if (1 in locs) {
      entry.catchLoc = locs[1];
    }

    if (2 in locs) {
      entry.finallyLoc = locs[2];
      entry.afterLoc = locs[3];
    }

    this.tryEntries.push(entry);
  }

  function resetTryEntry(entry) {
    var record = entry.completion || {};
    record.type = "normal";
    delete record.arg;
    entry.completion = record;
  }

  function Context(tryLocsList) {
    // The root entry object (effectively a try statement without a catch
    // or a finally block) gives us a place to store values thrown from
    // locations where there is no enclosing try statement.
    this.tryEntries = [{ tryLoc: "root" }];
    tryLocsList.forEach(pushTryEntry, this);
    this.reset(true);
  }

  exports.keys = function(val) {
    var object = Object(val);
    var keys = [];
    for (var key in object) {
      keys.push(key);
    }
    keys.reverse();

    // Rather than returning an object with a next method, we keep
    // things simple and return the next function itself.
    return function next() {
      while (keys.length) {
        var key = keys.pop();
        if (key in object) {
          next.value = key;
          next.done = false;
          return next;
        }
      }

      // To avoid creating an additional object, we just hang the .value
      // and .done properties off the next function object itself. This
      // also ensures that the minifier will not anonymize the function.
      next.done = true;
      return next;
    };
  };

  function values(iterable) {
    if (iterable) {
      var iteratorMethod = iterable[iteratorSymbol];
      if (iteratorMethod) {
        return iteratorMethod.call(iterable);
      }

      if (typeof iterable.next === "function") {
        return iterable;
      }

      if (!isNaN(iterable.length)) {
        var i = -1, next = function next() {
          while (++i < iterable.length) {
            if (hasOwn.call(iterable, i)) {
              next.value = iterable[i];
              next.done = false;
              return next;
            }
          }

          next.value = undefined;
          next.done = true;

          return next;
        };

        return next.next = next;
      }
    }

    // Return an iterator with no values.
    return { next: doneResult };
  }
  exports.values = values;

  function doneResult() {
    return { value: undefined, done: true };
  }

  Context.prototype = {
    constructor: Context,

    reset: function(skipTempReset) {
      this.prev = 0;
      this.next = 0;
      // Resetting context._sent for legacy support of Babel's
      // function.sent implementation.
      this.sent = this._sent = undefined;
      this.done = false;
      this.delegate = null;

      this.method = "next";
      this.arg = undefined;

      this.tryEntries.forEach(resetTryEntry);

      if (!skipTempReset) {
        for (var name in this) {
          // Not sure about the optimal order of these conditions:
          if (name.charAt(0) === "t" &&
              hasOwn.call(this, name) &&
              !isNaN(+name.slice(1))) {
            this[name] = undefined;
          }
        }
      }
    },

    stop: function() {
      this.done = true;

      var rootEntry = this.tryEntries[0];
      var rootRecord = rootEntry.completion;
      if (rootRecord.type === "throw") {
        throw rootRecord.arg;
      }

      return this.rval;
    },

    dispatchException: function(exception) {
      if (this.done) {
        throw exception;
      }

      var context = this;
      function handle(loc, caught) {
        record.type = "throw";
        record.arg = exception;
        context.next = loc;

        if (caught) {
          // If the dispatched exception was caught by a catch block,
          // then let that catch block handle the exception normally.
          context.method = "next";
          context.arg = undefined;
        }

        return !! caught;
      }

      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        var record = entry.completion;

        if (entry.tryLoc === "root") {
          // Exception thrown outside of any try block that could handle
          // it, so set the completion value of the entire function to
          // throw the exception.
          return handle("end");
        }

        if (entry.tryLoc <= this.prev) {
          var hasCatch = hasOwn.call(entry, "catchLoc");
          var hasFinally = hasOwn.call(entry, "finallyLoc");

          if (hasCatch && hasFinally) {
            if (this.prev < entry.catchLoc) {
              return handle(entry.catchLoc, true);
            } else if (this.prev < entry.finallyLoc) {
              return handle(entry.finallyLoc);
            }

          } else if (hasCatch) {
            if (this.prev < entry.catchLoc) {
              return handle(entry.catchLoc, true);
            }

          } else if (hasFinally) {
            if (this.prev < entry.finallyLoc) {
              return handle(entry.finallyLoc);
            }

          } else {
            throw new Error("try statement without catch or finally");
          }
        }
      }
    },

    abrupt: function(type, arg) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.tryLoc <= this.prev &&
            hasOwn.call(entry, "finallyLoc") &&
            this.prev < entry.finallyLoc) {
          var finallyEntry = entry;
          break;
        }
      }

      if (finallyEntry &&
          (type === "break" ||
           type === "continue") &&
          finallyEntry.tryLoc <= arg &&
          arg <= finallyEntry.finallyLoc) {
        // Ignore the finally entry if control is not jumping to a
        // location outside the try/catch block.
        finallyEntry = null;
      }

      var record = finallyEntry ? finallyEntry.completion : {};
      record.type = type;
      record.arg = arg;

      if (finallyEntry) {
        this.method = "next";
        this.next = finallyEntry.finallyLoc;
        return ContinueSentinel;
      }

      return this.complete(record);
    },

    complete: function(record, afterLoc) {
      if (record.type === "throw") {
        throw record.arg;
      }

      if (record.type === "break" ||
          record.type === "continue") {
        this.next = record.arg;
      } else if (record.type === "return") {
        this.rval = this.arg = record.arg;
        this.method = "return";
        this.next = "end";
      } else if (record.type === "normal" && afterLoc) {
        this.next = afterLoc;
      }

      return ContinueSentinel;
    },

    finish: function(finallyLoc) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.finallyLoc === finallyLoc) {
          this.complete(entry.completion, entry.afterLoc);
          resetTryEntry(entry);
          return ContinueSentinel;
        }
      }
    },

    "catch": function(tryLoc) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.tryLoc === tryLoc) {
          var record = entry.completion;
          if (record.type === "throw") {
            var thrown = record.arg;
            resetTryEntry(entry);
          }
          return thrown;
        }
      }

      // The context.catch method must only be called with a location
      // argument that corresponds to a known catch block.
      throw new Error("illegal catch attempt");
    },

    delegateYield: function(iterable, resultName, nextLoc) {
      this.delegate = {
        iterator: values(iterable),
        resultName: resultName,
        nextLoc: nextLoc
      };

      if (this.method === "next") {
        // Deliberately forget the last sent value so that we don't
        // accidentally pass it on to the delegate.
        this.arg = undefined;
      }

      return ContinueSentinel;
    }
  };

  // Regardless of whether this script is executing as a CommonJS module
  // or not, return the runtime object so that we can declare the variable
  // regeneratorRuntime in the outer scope, which allows this module to be
  // injected easily by `bin/regenerator --include-runtime script.js`.
  return exports;

}(
  // If this script is executing as a CommonJS module, use module.exports
  // as the regeneratorRuntime namespace. Otherwise create a new empty
  // object. Either way, the resulting object will be used to initialize
  // the regeneratorRuntime variable at the top of this file.
  typeof module === "object" ? module.exports : {}
));

try {
  regeneratorRuntime = runtime;
} catch (accidentalStrictMode) {
  // This module should not be running in strict mode, so the above
  // assignment should always work unless something is misconfigured. Just
  // in case runtime.js accidentally runs in strict mode, in modern engines
  // we can explicitly access globalThis. In older engines we can escape
  // strict mode using a global Function call. This could conceivably fail
  // if a Content Security Policy forbids using Function, but in that case
  // the proper solution is to fix the accidental strict mode problem. If
  // you've misconfigured your bundler to force strict mode and applied a
  // CSP to forbid Function, and you're not willing to fix either of those
  // problems, please detail your unique predicament in a GitHub issue.
  if (typeof globalThis === "object") {
    globalThis.regeneratorRuntime = runtime;
  } else {
    Function("r", "regeneratorRuntime = r")(runtime);
  }
}

function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _regenerator() { /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */ var e, t, r = "function" == typeof Symbol ? Symbol : {}, n = r.iterator || "@@iterator", o = r.toStringTag || "@@toStringTag"; function i(r, n, o, i) { var c = n && n.prototype instanceof Generator ? n : Generator, u = Object.create(c.prototype); return _regeneratorDefine2(u, "_invoke", function (r, n, o) { var i, c, u, f = 0, p = o || [], y = !1, G = { p: 0, n: 0, v: e, a: d, f: d.bind(e, 4), d: function d(t, r) { return i = t, c = 0, u = e, G.n = r, a; } }; function d(r, n) { for (c = r, u = n, t = 0; !y && f && !o && t < p.length; t++) { var o, i = p[t], d = G.p, l = i[2]; r > 3 ? (o = l === n) && (u = i[(c = i[4]) ? 5 : (c = 3, 3)], i[4] = i[5] = e) : i[0] <= d && ((o = r < 2 && d < i[1]) ? (c = 0, G.v = n, G.n = i[1]) : d < l && (o = r < 3 || i[0] > n || n > l) && (i[4] = r, i[5] = n, G.n = l, c = 0)); } if (o || r > 1) return a; throw y = !0, n; } return function (o, p, l) { if (f > 1) throw TypeError("Generator is already running"); for (y && 1 === p && d(p, l), c = p, u = l; (t = c < 2 ? e : u) || !y;) { i || (c ? (c > 1 && (G.n = c < 3 ? -1 : u), d(c, u)) : G.v = u); try { if (f = 2, i) { if (c || (o = "next"), t = i[o]) { if (!(t = t.call(i, u))) throw TypeError("iterator result is not an object"); if (!t.done) return t; u = t.value, c < 2 && (c = 0); } else 1 === c && (t = i.return) && t.call(i), c < 2 && (u = TypeError("The iterator does not provide a '" + o + "' method"), c = 1); i = e; } else if ((t = (y = G.n < 0) ? u : r.call(n, G)) !== a) break; } catch (t) { i = e, c = 1, u = t; } finally { f = 1; } } return { value: t, done: y }; }; }(r, o, i), !0), u; } var a = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} t = Object.getPrototypeOf; var c = [][n] ? t(t([][n]())) : (_regeneratorDefine2(t = {}, n, function () { return this; }), t), u = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(c); function f(e) { return Object.setPrototypeOf ? Object.setPrototypeOf(e, GeneratorFunctionPrototype) : (e.__proto__ = GeneratorFunctionPrototype, _regeneratorDefine2(e, o, "GeneratorFunction")), e.prototype = Object.create(u), e; } return GeneratorFunction.prototype = GeneratorFunctionPrototype, _regeneratorDefine2(u, "constructor", GeneratorFunctionPrototype), _regeneratorDefine2(GeneratorFunctionPrototype, "constructor", GeneratorFunction), GeneratorFunction.displayName = "GeneratorFunction", _regeneratorDefine2(GeneratorFunctionPrototype, o, "GeneratorFunction"), _regeneratorDefine2(u), _regeneratorDefine2(u, o, "Generator"), _regeneratorDefine2(u, n, function () { return this; }), _regeneratorDefine2(u, "toString", function () { return "[object Generator]"; }), (_regenerator = function _regenerator() { return { w: i, m: f }; })(); }
function _regeneratorDefine2(e, r, n, t) { var i = Object.defineProperty; try { i({}, "", {}); } catch (e) { i = 0; } _regeneratorDefine2 = function _regeneratorDefine(e, r, n, t) { function o(r, n) { _regeneratorDefine2(e, r, function (e) { return this._invoke(r, n, e); }); } r ? i ? i(e, r, { value: n, enumerable: !t, configurable: !t, writable: !t }) : e[r] = n : (o("next", 0), o("throw", 1), o("return", 2)); }, _regeneratorDefine2(e, r, n, t); }
function _slicedToArray(r, e) { return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest(); }
function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t.return && (u = t.return(), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function _arrayWithHoles(r) { if (Array.isArray(r)) return r; }
function _createForOfIteratorHelper(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (!t) { if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var _n = 0, F = function F() {}; return { s: F, n: function n() { return _n >= r.length ? { done: !0 } : { done: !1, value: r[_n++] }; }, e: function e(r) { throw r; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var o, a = !0, u = !1; return { s: function s() { t = t.call(r); }, n: function n() { var r = t.next(); return a = r.done, r; }, e: function e(r) { u = !0, o = r; }, f: function f() { try { a || null == t.return || t.return(); } finally { if (u) throw o; } } }; }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function asyncGeneratorStep(n, t, e, r, o, a, c) { try { var i = n[a](c), u = i.value; } catch (n) { return void e(n); } i.done ? t(u) : Promise.resolve(u).then(r, o); }
function _asyncToGenerator(n) { return function () { var t = this, e = arguments; return new Promise(function (r, o) { var a = n.apply(t, e); function _next(n) { asyncGeneratorStep(a, r, o, _next, _throw, "next", n); } function _throw(n) { asyncGeneratorStep(a, r, o, _next, _throw, "throw", n); } _next(void 0); }); }; }
function _defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, _toPropertyKey(o.key), o); } }
function _createClass(e, r, t) { return r && _defineProperties(e.prototype, r), t && _defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : i + ""; }
function _toPrimitive(t, e) { if ("object" != _typeof(t) || !t) return t; var r; if ("undefined" != typeof Symbol && void 0 !== (r = t[Symbol.toPrimitive])) { var i = r.call(t, e || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === e ? String : Number)(t); }
function _classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
function _callSuper(t, o, e) { return o = _getPrototypeOf(o), _possibleConstructorReturn(t, _isNativeReflectConstruct() ? Reflect.construct(o, e || [], _getPrototypeOf(t).constructor) : o.apply(t, e)); }
function _possibleConstructorReturn(t, e) { if (e && ("object" == _typeof(e) || "function" == typeof e)) return e; if (void 0 !== e) throw new TypeError("Derived constructors may only return object or undefined"); return _assertThisInitialized(t); }
function _assertThisInitialized(e) { if (void 0 === e) throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); return e; }
function _inherits(t, e) { if ("function" != typeof e && null !== e) throw new TypeError("Super expression must either be null or a function"); t.prototype = Object.create(e && e.prototype, { constructor: { value: t, writable: !0, configurable: !0 } }), Object.defineProperty(t, "prototype", { writable: !1 }), e && _setPrototypeOf(t, e); }
function _wrapNativeSuper(t) { var r = "function" == typeof Map ? new Map() : void 0; return _wrapNativeSuper = function _wrapNativeSuper(t) { if (null === t || !_isNativeFunction(t)) return t; if ("function" != typeof t) throw new TypeError("Super expression must either be null or a function"); if (void 0 !== r) { if (r.has(t)) return r.get(t); r.set(t, Wrapper); } function Wrapper() { return _construct(t, arguments, _getPrototypeOf(this).constructor); } return Wrapper.prototype = Object.create(t.prototype, { constructor: { value: Wrapper, enumerable: !1, writable: !0, configurable: !0 } }), _setPrototypeOf(Wrapper, t); }, _wrapNativeSuper(t); }
function _construct(t, e, r) { if (_isNativeReflectConstruct()) return Reflect.construct.apply(null, arguments); var o = [null]; o.push.apply(o, e); var p = new (t.bind.apply(t, o))(); return r && _setPrototypeOf(p, r.prototype), p; }
function _isNativeReflectConstruct() { try { var t = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); } catch (t) {} return (_isNativeReflectConstruct = function _isNativeReflectConstruct() { return !!t; })(); }
function _isNativeFunction(t) { try { return -1 !== Function.toString.call(t).indexOf("[native code]"); } catch (n) { return "function" == typeof t; } }
function _setPrototypeOf(t, e) { return _setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function (t, e) { return t.__proto__ = e, t; }, _setPrototypeOf(t, e); }
function _getPrototypeOf(t) { return _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function (t) { return t.__proto__ || Object.getPrototypeOf(t); }, _getPrototypeOf(t); }
/*! Capacitor: https://capacitorjs.com/ - MIT License */
/* Generated File. Do not edit. */

var nativeBridge = function (exports) {
  'use strict';

  var ExceptionCode;
  (function (ExceptionCode) {
    /**
     * API is not implemented.
     *
     * This usually means the API can't be used because it is not implemented for
     * the current platform.
     */
    ExceptionCode["Unimplemented"] = "UNIMPLEMENTED";
    /**
     * API is not available.
     *
     * This means the API can't be used right now because:
     *   - it is currently missing a prerequisite, such as network connectivity
     *   - it requires a particular platform or browser version
     */
    ExceptionCode["Unavailable"] = "UNAVAILABLE";
  })(ExceptionCode || (ExceptionCode = {}));
  var CapacitorException = /*#__PURE__*/function (_Error) {
    function CapacitorException(message, code, data) {
      var _this;
      _classCallCheck(this, CapacitorException);
      _this = _callSuper(this, CapacitorException, [message]);
      _this.message = message;
      _this.code = code;
      _this.data = data;
      return _this;
    }
    _inherits(CapacitorException, _Error);
    return _createClass(CapacitorException);
  }(/*#__PURE__*/_wrapNativeSuper(Error)); // For removing exports for iOS/Android, keep let for reassignment
  // eslint-disable-next-line
  var dummy = {};
  var readFileAsBase64 = function readFileAsBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onloadend = function () {
        var data = reader.result;
        resolve(btoa(data));
      };
      reader.onerror = reject;
      reader.readAsBinaryString(file);
    });
  };
  var convertFormData = /*#__PURE__*/function () {
    var _ref = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee(formData) {
      var newFormData, _iterator, _step, pair, _pair, key, value, base64File, _t;
      return _regenerator().w(function (_context) {
        while (1) switch (_context.p = _context.n) {
          case 0:
            newFormData = [];
            _iterator = _createForOfIteratorHelper(formData.entries());
            _context.p = 1;
            _iterator.s();
          case 2:
            if ((_step = _iterator.n()).done) {
              _context.n = 6;
              break;
            }
            pair = _step.value;
            _pair = _slicedToArray(pair, 2), key = _pair[0], value = _pair[1];
            if (!(value instanceof File)) {
              _context.n = 4;
              break;
            }
            _context.n = 3;
            return readFileAsBase64(value);
          case 3:
            base64File = _context.v;
            newFormData.push({
              key: key,
              value: base64File,
              type: 'base64File',
              contentType: value.type,
              fileName: value.name
            });
            _context.n = 5;
            break;
          case 4:
            newFormData.push({
              key: key,
              value: value,
              type: 'string'
            });
          case 5:
            _context.n = 2;
            break;
          case 6:
            _context.n = 8;
            break;
          case 7:
            _context.p = 7;
            _t = _context.v;
            _iterator.e(_t);
          case 8:
            _context.p = 8;
            _iterator.f();
            return _context.f(8);
          case 9:
            return _context.a(2, newFormData);
        }
      }, _callee, null, [[1, 7, 8, 9]]);
    }));
    return function convertFormData(_x) {
      return _ref.apply(this, arguments);
    };
  }();
  var convertBody = /*#__PURE__*/function () {
    var _ref2 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee2(body, contentType) {
      var encodedData, reader, chunks, _yield$reader$read, done, value, concatenated, position, _i, _chunks, chunk, data, type, formData, fileData;
      return _regenerator().w(function (_context2) {
        while (1) switch (_context2.n) {
          case 0:
            if (!(body instanceof ReadableStream || body instanceof Uint8Array)) {
              _context2.n = 7;
              break;
            }
            if (!(body instanceof ReadableStream)) {
              _context2.n = 5;
              break;
            }
            reader = body.getReader();
            chunks = [];
          case 1:
            if (!true) {
              _context2.n = 4;
              break;
            }
            _context2.n = 2;
            return reader.read();
          case 2:
            _yield$reader$read = _context2.v;
            done = _yield$reader$read.done;
            value = _yield$reader$read.value;
            if (!done) {
              _context2.n = 3;
              break;
            }
            return _context2.a(3, 4);
          case 3:
            chunks.push(value);
            _context2.n = 1;
            break;
          case 4:
            concatenated = new Uint8Array(chunks.reduce(function (acc, chunk) {
              return acc + chunk.length;
            }, 0));
            position = 0;
            for (_i = 0, _chunks = chunks; _i < _chunks.length; _i++) {
              chunk = _chunks[_i];
              concatenated.set(chunk, position);
              position += chunk.length;
            }
            encodedData = concatenated;
            _context2.n = 6;
            break;
          case 5:
            encodedData = body;
          case 6:
            data = new TextDecoder().decode(encodedData);
            if (contentType === 'application/json') {
              try {
                data = JSON.parse(data);
              } catch (ignored) {
                // ignore
              }
              type = 'json';
            } else if (contentType === 'multipart/form-data') {
              type = 'formData';
            } else if (contentType === null || contentType === void 0 ? void 0 : contentType.startsWith('image')) {
              type = 'image';
            } else if (contentType === 'application/octet-stream') {
              type = 'binary';
            } else {
              type = 'text';
            }
            return _context2.a(2, {
              data: data,
              type: type,
              headers: {
                'Content-Type': contentType || 'application/octet-stream'
              }
            });
          case 7:
            if (!(body instanceof URLSearchParams)) {
              _context2.n = 8;
              break;
            }
            return _context2.a(2, {
              data: body.toString(),
              type: 'text'
            });
          case 8:
            if (!(body instanceof FormData)) {
              _context2.n = 10;
              break;
            }
            _context2.n = 9;
            return convertFormData(body);
          case 9:
            formData = _context2.v;
            return _context2.a(2, {
              data: formData,
              type: 'formData'
            });
          case 10:
            if (!(body instanceof File)) {
              _context2.n = 12;
              break;
            }
            _context2.n = 11;
            return readFileAsBase64(body);
          case 11:
            fileData = _context2.v;
            return _context2.a(2, {
              data: fileData,
              type: 'file',
              headers: {
                'Content-Type': body.type
              }
            });
          case 12:
            return _context2.a(2, {
              data: body,
              type: 'json'
            });
        }
      }, _callee2);
    }));
    return function convertBody(_x2, _x3) {
      return _ref2.apply(this, arguments);
    };
  }();
  var CAPACITOR_HTTP_INTERCEPTOR = '/_capacitor_http_interceptor_';
  var CAPACITOR_HTTP_INTERCEPTOR_URL_PARAM = 'u';
  // TODO: export as Cap function
  var isRelativeOrProxyUrl = function isRelativeOrProxyUrl(url) {
    return !url || !(url.startsWith('http:') || url.startsWith('https:')) || url.indexOf(CAPACITOR_HTTP_INTERCEPTOR) > -1;
  };
  // TODO: export as Cap function
  var createProxyUrl = function createProxyUrl(url, win) {
    var _a, _b;
    if (isRelativeOrProxyUrl(url)) return url;
    var bridgeUrl = new URL((_b = (_a = win.Capacitor) === null || _a === void 0 ? void 0 : _a.getServerUrl()) !== null && _b !== void 0 ? _b : '');
    bridgeUrl.pathname = CAPACITOR_HTTP_INTERCEPTOR;
    bridgeUrl.searchParams.append(CAPACITOR_HTTP_INTERCEPTOR_URL_PARAM, url);
    return bridgeUrl.toString();
  };
  var initBridge = function initBridge(w) {
    var getPlatformId = function getPlatformId(win) {
      var _a, _b;
      if (win === null || win === void 0 ? void 0 : win.androidBridge) {
        return 'android';
      } else if ((_b = (_a = win === null || win === void 0 ? void 0 : win.webkit) === null || _a === void 0 ? void 0 : _a.messageHandlers) === null || _b === void 0 ? void 0 : _b.bridge) {
        return 'ios';
      } else {
        return 'web';
      }
    };
    var convertFileSrcServerUrl = function convertFileSrcServerUrl(webviewServerUrl, filePath) {
      if (typeof filePath === 'string') {
        if (filePath.startsWith('/')) {
          return webviewServerUrl + '/_capacitor_file_' + filePath;
        } else if (filePath.startsWith('file://')) {
          return webviewServerUrl + filePath.replace('file://', '/_capacitor_file_');
        } else if (filePath.startsWith('content://')) {
          return webviewServerUrl + filePath.replace('content:/', '/_capacitor_content_');
        }
      }
      return filePath;
    };
    var initEvents = function initEvents(win, cap) {
      cap.addListener = function (pluginName, eventName, callback) {
        var callbackId = cap.nativeCallback(pluginName, 'addListener', {
          eventName: eventName
        }, callback);
        return {
          remove: function () {
            var _remove = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee3() {
              var _a;
              return _regenerator().w(function (_context3) {
                while (1) switch (_context3.n) {
                  case 0:
                    (_a = win === null || win === void 0 ? void 0 : win.console) === null || _a === void 0 ? void 0 : _a.debug('Removing listener', pluginName, eventName);
                    cap.removeListener(pluginName, callbackId, eventName, callback);
                  case 1:
                    return _context3.a(2);
                }
              }, _callee3);
            }));
            function remove() {
              return _remove.apply(this, arguments);
            }
            return remove;
          }()
        };
      };
      cap.removeListener = function (pluginName, callbackId, eventName, callback) {
        cap.nativeCallback(pluginName, 'removeListener', {
          callbackId: callbackId,
          eventName: eventName
        }, callback);
      };
      cap.createEvent = function (eventName, eventData) {
        var doc = win.document;
        if (doc) {
          var ev = doc.createEvent('Events');
          ev.initEvent(eventName, false, false);
          if (eventData && _typeof(eventData) === 'object') {
            for (var i in eventData) {
              // eslint-disable-next-line no-prototype-builtins
              if (eventData.hasOwnProperty(i)) {
                ev[i] = eventData[i];
              }
            }
          }
          return ev;
        }
        return null;
      };
      cap.triggerEvent = function (eventName, target, eventData) {
        var doc = win.document;
        var cordova = win.cordova;
        eventData = eventData || {};
        var ev = cap.createEvent(eventName, eventData);
        if (ev) {
          if (target === 'document') {
            if (cordova === null || cordova === void 0 ? void 0 : cordova.fireDocumentEvent) {
              cordova.fireDocumentEvent(eventName, eventData);
              return true;
            } else if (doc === null || doc === void 0 ? void 0 : doc.dispatchEvent) {
              return doc.dispatchEvent(ev);
            }
          } else if (target === 'window' && win.dispatchEvent) {
            return win.dispatchEvent(ev);
          } else if (doc === null || doc === void 0 ? void 0 : doc.querySelector) {
            var targetEl = doc.querySelector(target);
            if (targetEl) {
              return targetEl.dispatchEvent(ev);
            }
          }
        }
        return false;
      };
      win.Capacitor = cap;
    };
    var initLegacyHandlers = function initLegacyHandlers(win, cap) {
      // define cordova if it's not there already
      win.cordova = win.cordova || {};
      var doc = win.document;
      var nav = win.navigator;
      if (nav) {
        nav.app = nav.app || {};
        nav.app.exitApp = function () {
          var _a;
          if (!((_a = cap.Plugins) === null || _a === void 0 ? void 0 : _a.App)) {
            win.console.warn('App plugin not installed');
          } else {
            cap.nativeCallback('App', 'exitApp', {});
          }
        };
      }
      if (doc) {
        var docAddEventListener = doc.addEventListener;
        doc.addEventListener = function () {
          var _a;
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }
          var eventName = args[0];
          var handler = args[1];
          if (eventName === 'deviceready' && handler) {
            Promise.resolve().then(handler);
          } else if (eventName === 'backbutton' && cap.Plugins.App) {
            // Add a dummy listener so Capacitor doesn't do the default
            // back button action
            if (!((_a = cap.Plugins) === null || _a === void 0 ? void 0 : _a.App)) {
              win.console.warn('App plugin not installed');
            } else {
              cap.Plugins.App.addListener('backButton', function () {
                // ignore
              });
            }
          }
          return docAddEventListener.apply(doc, args);
        };
      }
      // deprecated in v3, remove from v4
      cap.platform = cap.getPlatform();
      cap.isNative = cap.isNativePlatform();
      win.Capacitor = cap;
    };
    var initVendor = function initVendor(win, cap) {
      var Ionic = win.Ionic = win.Ionic || {};
      var IonicWebView = Ionic.WebView = Ionic.WebView || {};
      var Plugins = cap.Plugins;
      IonicWebView.getServerBasePath = function (callback) {
        var _a;
        (_a = Plugins === null || Plugins === void 0 ? void 0 : Plugins.WebView) === null || _a === void 0 ? void 0 : _a.getServerBasePath().then(function (result) {
          callback(result.path);
        });
      };
      IonicWebView.setServerAssetPath = function (path) {
        var _a;
        (_a = Plugins === null || Plugins === void 0 ? void 0 : Plugins.WebView) === null || _a === void 0 ? void 0 : _a.setServerAssetPath({
          path: path
        });
      };
      IonicWebView.setServerBasePath = function (path) {
        var _a;
        (_a = Plugins === null || Plugins === void 0 ? void 0 : Plugins.WebView) === null || _a === void 0 ? void 0 : _a.setServerBasePath({
          path: path
        });
      };
      IonicWebView.persistServerBasePath = function () {
        var _a;
        (_a = Plugins === null || Plugins === void 0 ? void 0 : Plugins.WebView) === null || _a === void 0 ? void 0 : _a.persistServerBasePath();
      };
      IonicWebView.convertFileSrc = function (url) {
        return cap.convertFileSrc(url);
      };
      win.Capacitor = cap;
      win.Ionic.WebView = IonicWebView;
    };
    var initLogger = function initLogger(win, cap) {
      var BRIDGED_CONSOLE_METHODS = ['debug', 'error', 'info', 'log', 'trace', 'warn'];
      var createLogFromNative = function createLogFromNative(c) {
        return function (result) {
          if (isFullConsole(c)) {
            var success = result.success === true;
            var tagStyles = success ? 'font-style: italic; font-weight: lighter; color: gray' : 'font-style: italic; font-weight: lighter; color: red';
            c.groupCollapsed('%cresult %c' + result.pluginId + '.' + result.methodName + ' (#' + result.callbackId + ')', tagStyles, 'font-style: italic; font-weight: bold; color: #444');
            if (result.success === false) {
              c.error(result.error);
            } else {
              c.dir(result.data);
            }
            c.groupEnd();
          } else {
            if (result.success === false) {
              c.error('LOG FROM NATIVE', result.error);
            } else {
              c.log('LOG FROM NATIVE', result.data);
            }
          }
        };
      };
      var createLogToNative = function createLogToNative(c) {
        return function (call) {
          if (isFullConsole(c)) {
            c.groupCollapsed('%cnative %c' + call.pluginId + '.' + call.methodName + ' (#' + call.callbackId + ')', 'font-weight: lighter; color: gray', 'font-weight: bold; color: #000');
            c.dir(call);
            c.groupEnd();
          } else {
            c.log('LOG TO NATIVE: ', call);
          }
        };
      };
      var isFullConsole = function isFullConsole(c) {
        if (!c) {
          return false;
        }
        return typeof c.groupCollapsed === 'function' || typeof c.groupEnd === 'function' || typeof c.dir === 'function';
      };
      var serializeConsoleMessage = function serializeConsoleMessage(msg) {
        try {
          if (_typeof(msg) === 'object') {
            msg = JSON.stringify(msg);
          }
          return String(msg);
        } catch (e) {
          return '';
        }
      };
      var platform = getPlatformId(win);
      if (platform == 'android' || platform == 'ios') {
        // patch document.cookie on Android/iOS
        win.CapacitorCookiesDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie') || Object.getOwnPropertyDescriptor(HTMLDocument.prototype, 'cookie');
        var doPatchCookies = false;
        // check if capacitor cookies is disabled before patching
        if (platform === 'ios') {
          // Use prompt to synchronously get capacitor cookies config.
          // https://stackoverflow.com/questions/29249132/wkwebview-complex-communication-between-javascript-native-code/49474323#49474323
          var payload = {
            type: 'CapacitorCookies.isEnabled'
          };
          var isCookiesEnabled = prompt(JSON.stringify(payload));
          if (isCookiesEnabled === 'true') {
            doPatchCookies = true;
          }
        } else if (typeof win.CapacitorCookiesAndroidInterface !== 'undefined') {
          var _isCookiesEnabled = win.CapacitorCookiesAndroidInterface.isEnabled();
          if (_isCookiesEnabled === true) {
            doPatchCookies = true;
          }
        }
        if (doPatchCookies) {
          Object.defineProperty(document, 'cookie', {
            get: function get() {
              var _a, _b, _c;
              if (platform === 'ios') {
                // Use prompt to synchronously get cookies.
                // https://stackoverflow.com/questions/29249132/wkwebview-complex-communication-between-javascript-native-code/49474323#49474323
                var _payload = {
                  type: 'CapacitorCookies.get'
                };
                var res = prompt(JSON.stringify(_payload));
                return res;
              } else if (typeof win.CapacitorCookiesAndroidInterface !== 'undefined') {
                // return original document.cookie since Android does not support filtering of `httpOnly` cookies
                return (_c = (_b = (_a = win.CapacitorCookiesDescriptor) === null || _a === void 0 ? void 0 : _a.get) === null || _b === void 0 ? void 0 : _b.call(document)) !== null && _c !== void 0 ? _c : '';
              }
            },
            set: function set(val) {
              var cookiePairs = val.split(';');
              var domainSection = val.toLowerCase().split('domain=')[1];
              var domain = cookiePairs.length > 1 && domainSection != null && domainSection.length > 0 ? domainSection.split(';')[0].trim() : '';
              if (platform === 'ios') {
                // Use prompt to synchronously set cookies.
                // https://stackoverflow.com/questions/29249132/wkwebview-complex-communication-between-javascript-native-code/49474323#49474323
                var _payload2 = {
                  type: 'CapacitorCookies.set',
                  action: val,
                  domain: domain
                };
                prompt(JSON.stringify(_payload2));
              } else if (typeof win.CapacitorCookiesAndroidInterface !== 'undefined') {
                win.CapacitorCookiesAndroidInterface.setCookie(domain, val);
              }
            }
          });
        }
        // patch fetch / XHR on Android/iOS
        // store original fetch & XHR functions
        win.CapacitorWebFetch = window.fetch;
        win.CapacitorWebXMLHttpRequest = {
          abort: window.XMLHttpRequest.prototype.abort,
          constructor: window.XMLHttpRequest.prototype.constructor,
          fullObject: window.XMLHttpRequest,
          getAllResponseHeaders: window.XMLHttpRequest.prototype.getAllResponseHeaders,
          getResponseHeader: window.XMLHttpRequest.prototype.getResponseHeader,
          open: window.XMLHttpRequest.prototype.open,
          prototype: window.XMLHttpRequest.prototype,
          send: window.XMLHttpRequest.prototype.send,
          setRequestHeader: window.XMLHttpRequest.prototype.setRequestHeader
        };
        var doPatchHttp = false;
        // check if capacitor http is disabled before patching
        if (platform === 'ios') {
          // Use prompt to synchronously get capacitor http config.
          // https://stackoverflow.com/questions/29249132/wkwebview-complex-communication-between-javascript-native-code/49474323#49474323
          var _payload3 = {
            type: 'CapacitorHttp'
          };
          var isHttpEnabled = prompt(JSON.stringify(_payload3));
          if (isHttpEnabled === 'true') {
            doPatchHttp = true;
          }
        } else if (typeof win.CapacitorHttpAndroidInterface !== 'undefined') {
          var _isHttpEnabled = win.CapacitorHttpAndroidInterface.isEnabled();
          if (_isHttpEnabled === true) {
            doPatchHttp = true;
          }
        }
        if (doPatchHttp) {
          // fetch patch
          window.fetch = /*#__PURE__*/function () {
            var _ref3 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee4(resource, options) {
              var headers, contentType, request, method, modifiedRequest, tag, body, optionHeaders, _yield$convertBody, requestData, type, _headers, nativeResponse, _contentType, data, response, _t2;
              return _regenerator().w(function (_context4) {
                while (1) switch (_context4.p = _context4.n) {
                  case 0:
                    headers = new Headers(options === null || options === void 0 ? void 0 : options.headers);
                    contentType = headers.get('Content-Type') || headers.get('content-type');
                    if ((options === null || options === void 0 ? void 0 : options.body) instanceof FormData && (contentType === null || contentType === void 0 ? void 0 : contentType.includes('multipart/form-data')) && !contentType.includes('boundary')) {
                      headers.delete('Content-Type');
                      headers.delete('content-type');
                      options.headers = headers;
                    }
                    request = new Request(resource, options);
                    if (!request.url.startsWith("".concat(cap.getServerUrl(), "/"))) {
                      _context4.n = 1;
                      break;
                    }
                    return _context4.a(2, win.CapacitorWebFetch(resource, options));
                  case 1:
                    method = request.method;
                    if (!(method.toLocaleUpperCase() === 'GET' || method.toLocaleUpperCase() === 'HEAD' || method.toLocaleUpperCase() === 'OPTIONS' || method.toLocaleUpperCase() === 'TRACE')) {
                      _context4.n = 5;
                      break;
                    }
                    if (!(typeof resource === 'string')) {
                      _context4.n = 3;
                      break;
                    }
                    _context4.n = 2;
                    return win.CapacitorWebFetch(createProxyUrl(resource, win), options);
                  case 2:
                    return _context4.a(2, _context4.v);
                  case 3:
                    if (!(resource instanceof Request)) {
                      _context4.n = 5;
                      break;
                    }
                    modifiedRequest = new Request(createProxyUrl(resource.url, win), resource);
                    _context4.n = 4;
                    return win.CapacitorWebFetch(modifiedRequest, options);
                  case 4:
                    return _context4.a(2, _context4.v);
                  case 5:
                    tag = "CapacitorHttp fetch ".concat(Date.now(), " ").concat(resource);
                    console.time(tag);
                    _context4.p = 6;
                    body = request.body;
                    optionHeaders = Object.fromEntries(request.headers.entries());
                    _context4.n = 7;
                    return convertBody((options === null || options === void 0 ? void 0 : options.body) || body || undefined, optionHeaders['Content-Type'] || optionHeaders['content-type']);
                  case 7:
                    _yield$convertBody = _context4.v;
                    requestData = _yield$convertBody.data;
                    type = _yield$convertBody.type;
                    _headers = _yield$convertBody.headers;
                    _context4.n = 8;
                    return cap.nativePromise('CapacitorHttp', 'request', {
                      url: request.url,
                      method: method,
                      data: requestData,
                      dataType: type,
                      headers: Object.assign(Object.assign({}, _headers), optionHeaders)
                    });
                  case 8:
                    nativeResponse = _context4.v;
                    _contentType = nativeResponse.headers['Content-Type'] || nativeResponse.headers['content-type'];
                    data = (_contentType === null || _contentType === void 0 ? void 0 : _contentType.startsWith('application/json')) ? JSON.stringify(nativeResponse.data) : nativeResponse.data; // use null data for 204 No Content HTTP response
                    if (nativeResponse.status === 204) {
                      data = null;
                    }
                    // intercept & parse response before returning
                    response = new Response(data, {
                      headers: nativeResponse.headers,
                      status: nativeResponse.status
                    });
                    /*
                     * copy url to response, `cordova-plugin-ionic` uses this url from the response
                     * we need `Object.defineProperty` because url is an inherited getter on the Response
                     * see: https://stackoverflow.com/a/57382543
                     * */
                    Object.defineProperty(response, 'url', {
                      value: nativeResponse.url
                    });
                    console.timeEnd(tag);
                    return _context4.a(2, response);
                  case 9:
                    _context4.p = 9;
                    _t2 = _context4.v;
                    console.timeEnd(tag);
                    return _context4.a(2, Promise.reject(_t2));
                }
              }, _callee4, null, [[6, 9]]);
            }));
            return function (_x4, _x5) {
              return _ref3.apply(this, arguments);
            };
          }();
          window.XMLHttpRequest = function () {
            var xhr = new win.CapacitorWebXMLHttpRequest.constructor();
            Object.defineProperties(xhr, {
              _headers: {
                value: {},
                writable: true
              },
              _method: {
                value: xhr.method,
                writable: true
              }
            });
            var prototype = win.CapacitorWebXMLHttpRequest.prototype;
            var isProgressEventAvailable = function isProgressEventAvailable() {
              return typeof ProgressEvent !== 'undefined' && ProgressEvent.prototype instanceof Event;
            };
            // XHR patch abort
            prototype.abort = function () {
              var _this2 = this;
              if (isRelativeOrProxyUrl(this._url)) {
                return win.CapacitorWebXMLHttpRequest.abort.call(this);
              }
              this.readyState = 0;
              setTimeout(function () {
                _this2.dispatchEvent(new Event('abort'));
                _this2.dispatchEvent(new Event('loadend'));
              });
            };
            // XHR patch open
            prototype.open = function (method, url) {
              var _this4 = this;
              this._method = method.toLocaleUpperCase();
              this._url = url;
              if (!this._method || this._method === 'GET' || this._method === 'HEAD' || this._method === 'OPTIONS' || this._method === 'TRACE') {
                if (isRelativeOrProxyUrl(url)) {
                  return win.CapacitorWebXMLHttpRequest.open.call(this, method, url);
                }
                this._url = createProxyUrl(this._url, win);
                return win.CapacitorWebXMLHttpRequest.open.call(this, method, this._url);
              }
              Object.defineProperties(this, {
                readyState: {
                  get: function get() {
                    var _a;
                    return (_a = this._readyState) !== null && _a !== void 0 ? _a : 0;
                  },
                  set: function set(val) {
                    var _this3 = this;
                    this._readyState = val;
                    setTimeout(function () {
                      _this3.dispatchEvent(new Event('readystatechange'));
                    });
                  }
                }
              });
              setTimeout(function () {
                _this4.dispatchEvent(new Event('loadstart'));
              });
              this.readyState = 1;
            };
            // XHR patch set request header
            prototype.setRequestHeader = function (header, value) {
              if (isRelativeOrProxyUrl(this._url)) {
                return win.CapacitorWebXMLHttpRequest.setRequestHeader.call(this, header, value);
              }
              this._headers[header] = value;
            };
            // XHR patch send
            prototype.send = function (body) {
              var _this5 = this;
              if (isRelativeOrProxyUrl(this._url)) {
                return win.CapacitorWebXMLHttpRequest.send.call(this, body);
              }
              var tag = "CapacitorHttp XMLHttpRequest ".concat(Date.now(), " ").concat(this._url);
              console.time(tag);
              try {
                this.readyState = 2;
                Object.defineProperties(this, {
                  response: {
                    value: '',
                    writable: true
                  },
                  responseText: {
                    value: '',
                    writable: true
                  },
                  responseURL: {
                    value: '',
                    writable: true
                  },
                  status: {
                    value: 0,
                    writable: true
                  }
                });
                convertBody(body).then(function (_ref4) {
                  var data = _ref4.data,
                    type = _ref4.type,
                    headers = _ref4.headers;
                  var otherHeaders = _this5._headers != null && Object.keys(_this5._headers).length > 0 ? _this5._headers : undefined;
                  // intercept request & pass to the bridge
                  cap.nativePromise('CapacitorHttp', 'request', {
                    url: _this5._url,
                    method: _this5._method,
                    data: data !== null ? data : undefined,
                    headers: Object.assign(Object.assign({}, headers), otherHeaders),
                    dataType: type
                  }).then(function (nativeResponse) {
                    var _a;
                    // intercept & parse response before returning
                    if (_this5.readyState == 2) {
                      //TODO: Add progress event emission on native side
                      if (isProgressEventAvailable()) {
                        _this5.dispatchEvent(new ProgressEvent('progress', {
                          lengthComputable: true,
                          loaded: nativeResponse.data.length,
                          total: nativeResponse.data.length
                        }));
                      }
                      _this5._headers = nativeResponse.headers;
                      _this5.status = nativeResponse.status;
                      if (_this5.responseType === '' || _this5.responseType === 'text') {
                        _this5.response = typeof nativeResponse.data !== 'string' ? JSON.stringify(nativeResponse.data) : nativeResponse.data;
                      } else {
                        _this5.response = nativeResponse.data;
                      }
                      _this5.responseText = ((_a = nativeResponse.headers['Content-Type'] || nativeResponse.headers['content-type']) === null || _a === void 0 ? void 0 : _a.startsWith('application/json')) ? JSON.stringify(nativeResponse.data) : nativeResponse.data;
                      _this5.responseURL = nativeResponse.url;
                      _this5.readyState = 4;
                      setTimeout(function () {
                        _this5.dispatchEvent(new Event('load'));
                        _this5.dispatchEvent(new Event('loadend'));
                      });
                    }
                    console.timeEnd(tag);
                  }).catch(function (error) {
                    _this5.status = error.status;
                    _this5._headers = error.headers;
                    _this5.response = error.data;
                    _this5.responseText = JSON.stringify(error.data);
                    _this5.responseURL = error.url;
                    _this5.readyState = 4;
                    if (isProgressEventAvailable()) {
                      _this5.dispatchEvent(new ProgressEvent('progress', {
                        lengthComputable: false,
                        loaded: 0,
                        total: 0
                      }));
                    }
                    setTimeout(function () {
                      _this5.dispatchEvent(new Event('error'));
                      _this5.dispatchEvent(new Event('loadend'));
                    });
                    console.timeEnd(tag);
                  });
                });
              } catch (error) {
                this.status = 500;
                this._headers = {};
                this.response = error;
                this.responseText = error.toString();
                this.responseURL = this._url;
                this.readyState = 4;
                if (isProgressEventAvailable()) {
                  this.dispatchEvent(new ProgressEvent('progress', {
                    lengthComputable: false,
                    loaded: 0,
                    total: 0
                  }));
                }
                setTimeout(function () {
                  _this5.dispatchEvent(new Event('error'));
                  _this5.dispatchEvent(new Event('loadend'));
                });
                console.timeEnd(tag);
              }
            };
            // XHR patch getAllResponseHeaders
            prototype.getAllResponseHeaders = function () {
              if (isRelativeOrProxyUrl(this._url)) {
                return win.CapacitorWebXMLHttpRequest.getAllResponseHeaders.call(this);
              }
              var returnString = '';
              for (var key in this._headers) {
                if (key != 'Set-Cookie') {
                  returnString += key + ': ' + this._headers[key] + '\r\n';
                }
              }
              return returnString;
            };
            // XHR patch getResponseHeader
            prototype.getResponseHeader = function (name) {
              if (isRelativeOrProxyUrl(this._url)) {
                return win.CapacitorWebXMLHttpRequest.getResponseHeader.call(this, name);
              }
              return this._headers[name];
            };
            Object.setPrototypeOf(xhr, prototype);
            return xhr;
          };
          Object.assign(window.XMLHttpRequest, win.CapacitorWebXMLHttpRequest.fullObject);
        }
      }
      // patch window.console on iOS and store original console fns
      var isIos = getPlatformId(win) === 'ios';
      if (win.console && isIos) {
        Object.defineProperties(win.console, BRIDGED_CONSOLE_METHODS.reduce(function (props, method) {
          var consoleMethod = win.console[method].bind(win.console);
          props[method] = {
            value: function value() {
              for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
                args[_key2] = arguments[_key2];
              }
              var msgs = [].concat(args);
              cap.toNative('Console', 'log', {
                level: method,
                message: msgs.map(serializeConsoleMessage).join(' ')
              });
              return consoleMethod.apply(void 0, args);
            }
          };
          return props;
        }, {}));
      }
      cap.logJs = function (msg, level) {
        switch (level) {
          case 'error':
            win.console.error(msg);
            break;
          case 'warn':
            win.console.warn(msg);
            break;
          case 'info':
            win.console.info(msg);
            break;
          default:
            win.console.log(msg);
        }
      };
      cap.logToNative = createLogToNative(win.console);
      cap.logFromNative = createLogFromNative(win.console);
      cap.handleError = function (err) {
        return win.console.error(err);
      };
      win.Capacitor = cap;
    };
    function initNativeBridge(win) {
      var cap = win.Capacitor || {};
      // keep a collection of callbacks for native response data
      var callbacks = new Map();
      var webviewServerUrl = typeof win.WEBVIEW_SERVER_URL === 'string' ? win.WEBVIEW_SERVER_URL : '';
      cap.getServerUrl = function () {
        return webviewServerUrl;
      };
      cap.convertFileSrc = function (filePath) {
        return convertFileSrcServerUrl(webviewServerUrl, filePath);
      };
      // Counter of callback ids, randomized to avoid
      // any issues during reloads if a call comes back with
      // an existing callback id from an old session
      var callbackIdCount = Math.floor(Math.random() * 134217728);
      var postToNative = null;
      var isNativePlatform = function isNativePlatform() {
        return true;
      };
      var getPlatform = function getPlatform() {
        return getPlatformId(win);
      };
      cap.getPlatform = getPlatform;
      cap.isPluginAvailable = function (name) {
        return Object.prototype.hasOwnProperty.call(cap.Plugins, name);
      };
      cap.isNativePlatform = isNativePlatform;
      // create the postToNative() fn if needed
      if (getPlatformId(win) === 'android') {
        // android platform
        postToNative = function postToNative(data) {
          var _a;
          try {
            win.androidBridge.postMessage(JSON.stringify(data));
          } catch (e) {
            (_a = win === null || win === void 0 ? void 0 : win.console) === null || _a === void 0 ? void 0 : _a.error(e);
          }
        };
      } else if (getPlatformId(win) === 'ios') {
        // ios platform
        postToNative = function postToNative(data) {
          var _a;
          try {
            data.type = data.type ? data.type : 'message';
            win.webkit.messageHandlers.bridge.postMessage(data);
          } catch (e) {
            (_a = win === null || win === void 0 ? void 0 : win.console) === null || _a === void 0 ? void 0 : _a.error(e);
          }
        };
      }
      cap.handleWindowError = function (msg, url, lineNo, columnNo, err) {
        var str = msg.toLowerCase();
        if (str.indexOf('script error') > -1) ;else {
          var errObj = {
            type: 'js.error',
            error: {
              message: msg,
              url: url,
              line: lineNo,
              col: columnNo,
              errorObject: JSON.stringify(err)
            }
          };
          if (err !== null) {
            cap.handleError(err);
          }
          postToNative(errObj);
        }
        return false;
      };
      if (cap.DEBUG) {
        window.onerror = cap.handleWindowError;
      }
      initLogger(win, cap);
      /**
       * Send a plugin method call to the native layer
       */
      cap.toNative = function (pluginName, methodName, options, storedCallback) {
        var _a, _b;
        try {
          if (typeof postToNative === 'function') {
            var callbackId = '-1';
            if (storedCallback && (typeof storedCallback.callback === 'function' || typeof storedCallback.resolve === 'function')) {
              // store the call for later lookup
              callbackId = String(++callbackIdCount);
              callbacks.set(callbackId, storedCallback);
            }
            var callData = {
              callbackId: callbackId,
              pluginId: pluginName,
              methodName: methodName,
              options: options || {}
            };
            if (cap.isLoggingEnabled && pluginName !== 'Console') {
              cap.logToNative(callData);
            }
            // post the call data to native
            postToNative(callData);
            return callbackId;
          } else {
            (_a = win === null || win === void 0 ? void 0 : win.console) === null || _a === void 0 ? void 0 : _a.warn("implementation unavailable for: ".concat(pluginName));
          }
        } catch (e) {
          (_b = win === null || win === void 0 ? void 0 : win.console) === null || _b === void 0 ? void 0 : _b.error(e);
        }
        return null;
      };
      if (win === null || win === void 0 ? void 0 : win.androidBridge) {
        win.androidBridge.onmessage = function (event) {
          returnResult(JSON.parse(event.data));
        };
      }
      /**
       * Process a response from the native layer.
       */
      cap.fromNative = function (result) {
        returnResult(result);
      };
      var returnResult = function returnResult(result) {
        var _a, _b;
        if (cap.isLoggingEnabled && result.pluginId !== 'Console') {
          cap.logFromNative(result);
        }
        // get the stored call, if it exists
        try {
          var storedCall = callbacks.get(result.callbackId);
          if (storedCall) {
            // looks like we've got a stored call
            if (result.error) {
              // ensure stacktraces by copying error properties to an Error
              result.error = Object.keys(result.error).reduce(function (err, key) {
                // use any type to avoid importing util and compiling most of .ts files
                err[key] = result.error[key];
                return err;
              }, new cap.Exception(''));
            }
            if (typeof storedCall.callback === 'function') {
              // callback
              if (result.success) {
                storedCall.callback(result.data);
              } else {
                storedCall.callback(null, result.error);
              }
            } else if (typeof storedCall.resolve === 'function') {
              // promise
              if (result.success) {
                storedCall.resolve(result.data);
              } else {
                storedCall.reject(result.error);
              }
              // no need to keep this stored callback
              // around for a one time resolve promise
              callbacks.delete(result.callbackId);
            }
          } else if (!result.success && result.error) {
            // no stored callback, but if there was an error let's log it
            (_a = win === null || win === void 0 ? void 0 : win.console) === null || _a === void 0 ? void 0 : _a.warn(result.error);
          }
          if (result.save === false) {
            callbacks.delete(result.callbackId);
          }
        } catch (e) {
          (_b = win === null || win === void 0 ? void 0 : win.console) === null || _b === void 0 ? void 0 : _b.error(e);
        }
        // always delete to prevent memory leaks
        // overkill but we're not sure what apps will do with this data
        delete result.data;
        delete result.error;
      };
      cap.nativeCallback = function (pluginName, methodName, options, callback) {
        if (typeof options === 'function') {
          console.warn("Using a callback as the 'options' parameter of 'nativeCallback()' is deprecated.");
          callback = options;
          options = null;
        }
        return cap.toNative(pluginName, methodName, options, {
          callback: callback
        });
      };
      cap.nativePromise = function (pluginName, methodName, options) {
        return new Promise(function (resolve, reject) {
          cap.toNative(pluginName, methodName, options, {
            resolve: resolve,
            reject: reject
          });
        });
      };
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      cap.withPlugin = function (_pluginId, _fn) {
        return dummy;
      };
      cap.Exception = CapacitorException;
      initEvents(win, cap);
      initLegacyHandlers(win, cap);
      initVendor(win, cap);
      win.Capacitor = cap;
    }
    initNativeBridge(w);
  };
  initBridge(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : {});
  dummy = initBridge;
  Object.defineProperty(exports, '__esModule', {
    value: true
  });
  return exports;
}({});