(function($) {

var host = "/"; // TODO: calculate

var init = function() {
	var col = new Column("index", []);
	col.items = ["recipes", "bags", "users"]; // no sorting -- XXX: hacky?
	col.listType = "ul";
	delete col.label;
	col.controls = null;
	col = col.render().appendTo("nav.pane");
	$("li:last a", col).addClass("disabled").unbind("click"); // XXX: hacky?

	$("nav li a").live("click", function(ev) { // XXX: breaks encapsulation!?
		$(this).blur(). // hack to prevent Firefox from invoking :focus
			not(".disabled").closest("li").
				siblings().children().removeClass("selected").end().end().
				find("a").addClass("selected");
	});

	$("#btnFullscreen").click(function(ev) {
		cmd.toggleFullscreen();
	});
};

var cmd = tiddlyweb.commander = {
	addNavColumn: function(list, type, names, items) {
		list.nextAll().remove();
		var col = new Column(type, names);
		if(items) {
			col.data = items;
		}
		col.render().appendTo("nav.pane");
	},
	toggleFullscreen: function() { // TODO: argument to avoid hard-coding the last pane
		var els = $(".pane:visible");
		if(els.length > 1) {
			els.slice(0, -1).slideUp(function() {
				els.eq(-1).css("height", "100%"); // XXX: executed multiple times
			});
		} else {
			$(".pane").slideDown(function() { // XXX: fullscreen pane needs special handling to ensure smooth animation
				$(this).removeAttr("style");
			});
		}
	},
	notify: function(msg, type) {
		type = type || "info";
		$("#notification").addClass(type).text(msg).slideDown("slow").
			click(function(ev) { $(this).slideUp(); });
	}
};

var filterList = function(ev) {
	var el = $(this);
	var filter = el.val().toLowerCase();
	el.closest(".column").find("li").each(function(i, item) {
		var el = $(this);
		if(el.find("a").text().toLowerCase().indexOf(filter) != -1) {
			el.slideDown();
		} else {
			el.slideUp();
		}
	});
};

var errback = function(xhr, error, exc) {
	var msg = xhr.statusText + ": " + xhr.responseText;
	cmd.notify(msg, "error");
};

var columnActions = { // XXX: rename?
	index: function(name, column) { // XXX: rename?
		var collection = new tiddlyweb.Collection(name, host);
		var callback = function(data, status, xhr) {
			cmd.addNavColumn(column.node, name, data);
		};
		collection.get(callback, errback);
	},
	recipes: function(name, column) {
		var recipe = new tiddlyweb.Recipe(name, host);

		var eCallback = function(recipe, status, xhr) {
			recipe.render().replaceAll(".pane article"); // XXX: selector too unspecific?!
		};
		recipe.get(eCallback, errback);

		var cCallback = function(data, status, xhr) {
			var titles = $.map(data, function(item, i) {
				return item.title;
			});
			cmd.addNavColumn(column.node, "tiddlers", titles, data);
		};
		recipe.tiddlers().get(cCallback, errback);
	},
	bags: function(name, column) { // TODO: DRY (cf. recipes)
		var bag = new tiddlyweb.Bag(name, host);

		var eCallback = function(bag, status, xhr) {
			bag.render().replaceAll(".pane article"); // XXX: selector too unspecific?!
		};
		var eErrback = function(xhr, error, exc) {
			if(xhr.status == 401) {
				bag.desc = "unauthorized"; // XXX: i18n -- XXX: hacky?
				bag.render().replaceAll(".pane article").addClass("error"); // XXX: selector too unspecific?!
			} else {
				errback.apply(this, arguments);
			}
		};
		bag.get(eCallback, eErrback);

		var cCallback = function(data, status, xhr) {
			var titles = $.map(data, function(item, i) {
				return item.title;
			});
			cmd.addNavColumn(column.node, "tiddlers", titles, data);
		};
		bag.tiddlers().get(cCallback, errback);
	},
	tiddlers: function(name, column) {
		var tid;
		$.each(column.data, function(i, item) { // XXX: inefficient
			tid = item;
			return tid.title != name;
		});

		var eCallback = function(tid, status, xhr) {
			tid.render().replaceAll(".pane article"); // XXX: selector too unspecific?!
		};
		tid.get(eCallback, errback);

		var cCallback = function(data, status, xhr) {
			var names = $.map(data, function(item, i) {
				return item.revision;
			});
			cmd.addNavColumn(column.node, "revisions", names, data);
		};
		tid.revisions().get(cCallback, errback);
	},
	revisions: function(name, column) { // TODO: DRY (cf. tiddlers)
		var tid;
		$.each(column.data, function(i, item) { // XXX: inefficient
			tid = item;
			return tid.revision != name;
		});
		var rev = new tiddlyweb.Revision(tid.revision, tid);
		var callback = function(tid, status, xhr) {
			tid.render().replaceAll(".pane article"); // XXX: selector too unspecific?!
		};
		rev.get(callback, errback);
	}
};

var Column = function(type, items) {
	this.type = type;
	this.label = tiddlyweb._capitalize(type); // XXX: hacky?
	this.listType = "ol";
	this.items = items.sort(function(a, b) { // XXX: inefficient!?
		var x = a.toLowerCase ? a.toLowerCase() : a;
		var y = b.toLowerCase ? b.toLowerCase() : b;
		return ((x < y) ? -1 : ((x > y) ? 1 : 0));
	});
	var self = this;
	this.onClick = function(ev) {
		var name = $(this).text(); // XXX: brittle (e.g. i18n)
		columnActions[type].apply(this, [name, self]);
	};
};
Column.prototype.controls = $('<input type="search" placeholder="filter" />'). // XXX: i18n
	change(filterList).keyup(function(ev) {
		var filter = $(this).val();
		if(filter.length > 2) {
			clearTimeout(this.timeout || null);
			var self = this;
			this.timeout = setTimeout(function() {
				filterList.apply(self, []);
			}, 500);
		}
	});
Column.prototype.render = function() {
	var heading = this.label ? $("<h3 />").text(this.label) : null;
	var controls = this.controls ? this.controls.clone(true) : null;
	this.node = $('<section class="column" />').append(heading).append(controls);
	var self = this;
	$("<" + this.listType + " />").
		append($.map(this.items, function(item, i) {
			var btn = $('<a href="javascript:;" />').text(item).
				click(self.onClick);
			return $("<li />").append(btn)[0];
		})).
		appendTo(this.node);
	return this.node;
};

tiddlyweb.Recipe.prototype.render = function() {
	var lbl = $("<h3 />").text(this.name);
	var desc = $("<p />").text(this.desc);
	var content = $.map(this.recipe, function(item, i) {
		return item[1] ? item[0] + "?" + item[1] : item[0];
	}).join("\n");
	content = $("<pre />").text(content);
	return $("<article />").append(lbl).append(desc).append(content);
};

tiddlyweb.Bag.prototype.render = function() {
	var lbl = $("<h3 />").text(this.name);
	var desc = $("<p />").text(this.desc);
	return $("<article />").append(lbl).append(desc);
};

tiddlyweb.Tiddler.prototype.render = function() {
	var lbl = $("<h3 />").text(this.title);
	var txt = $("<pre />").text(this.text);
	return $("<article />").append(lbl).append(txt);
};

// XXX: DEBUG
$.ajax = function(options, isCallback) {
	if(!isCallback) {
		return setTimeout(function() {
			$.ajax(options, true);
		}, 500);
	}

	var xhr = {};
	var data;

	cmd.notify("URI: " + options.url);

	var path = $.map(options.url.split("/"), function(item, i) {
		return decodeURIComponent(item);
	});
	var resource = path.pop();
	switch(resource) {
		case "recipes":
			data = ["Omega"];
			break;
		case "bags":
			data = ["Alpha", "Bravo", "Charlie", "Delta"];
			break;
		case "tiddlers":
			var bag = path[1] == "bags" ? path[2] : "Foxtrot";
			var recipe = path[1] == "recipes" ? path[2] : undefined;
			data = $.map(["Foo", "Bar", "Baz"], function(item, i) {
				item = {
					title: bag + "::" + item,
					bag: bag
				};
				if(recipe) {
					item.recipe = recipe;
				}
				return item;
			});
			break;
		case "revisions":
			var container = {
				type: path[1] == "bags" ? "bag" : "recipe",
				name: path[2]
			};
			var revs = Math.random().toString().substr(2).split("");
			data = $.map(revs, function(item, i) {
				var rand = Math.random();
				item = {
					title: path[path.length - 1],
					revision: Math.floor(rand * 1000 * item + 1)
				};
				item[container.type] = container.name;
				return item;
			});
			break;
		default:
			var type = path.pop();
			switch(type) {
				case "recipes":
					data = {
						desc: "lorem ipsum dolor sit amet",
						policy: {},
						recipe: [
							["Alpha", ""],
							["Charlie", "select=tag:foo"],
							["Bravo", ""]
						]
					};
					break;
				case "bags":
					data = {
						desc: "lorem ipsum dolor sit amet",
						policy: {}
					};
					if(resource == "Bravo") {
						data = null;
						xhr.status = 401;
					}
					break;
				case "tiddlers":
					data = {
						title: resource,
						text: "lorem ipsum\ndolor sit amet\n\nconsectetur adipisicing elit\nsed do eiusmod tempor"
					};
					break;
				case "revisions":
					data = {
						title: path.pop(),
						text: "lorem ipsum\ndolor sit amet"
					};
					break;
			}
	}
	if(data) {
		xhr.status = 200;
		options.success(data, "success", xhr);
	} else {
		xhr.statusText = "error";
		xhr.responseText = resource + " failed";
		options.error(xhr, "error", {});
	}
};
// XXX: /DEBUG

init();

})(jQuery);
