(function () {
'use strict';

/*
 * Phenogrid
 *
 * Phenogrid is implemented as a jQuery UI widget. The phenogrid widget uses semantic similarity calculations provided
 * by OWLSim (www.owlsim.org),  as provided through APIs from the Monarch Initiative (www.monarchinitiative.org).
 *
 * Phenogrid widget can be instantiated on a jquery-enabled web page with a call of the form
 *
 * window.onload = function() {
 *     Phenogrid.createPhenogridForElement(document.getElementById('phenogrid_container'), {
 *         serverURL : "http://beta.monarchinitiative.org",
 *         phenotypeData: phenotypes,
 *         targetSpeciesName: "Mus musculus"
 *     });
 * }
 *
 * 'phenogrid_container' is the id of the div that will contain the phenogrid widget
 *	phenotypes is a Javascript array of objects listing the phenotypes to be rendered in the widget, it takes one of two forms:
 *
 *	1. A list of hashes
 *		[{"id": "HP:12345", "observed":"positive"}, {"id: "HP:23451", "observed": "negative"}, ...]
 *	2. A list of phenotype ids
 *		["HP:12345", "HP:23451"]
 *
 *	Configuration options useful for setting species displayed, similarity calculations, and
 *	related parameters can also be passed in this hash. As of September
 *	2014, these options are currently being refactored - further
 *	documentation hopefully coming soon.
 *
 *	Given an input list of phenotypes and parameters indicating
 *	desired source of matching models (humans, model organisms, etc.),
 *	the phenogrid will call the Monarch API to get OWLSim results
 *	consisting of arrays of the items of the following form:
 *	{
 *		"id":"HP_0000716_MP_0001413_MGI_006446",
 *		"label_a":"Depression",
 *		"id_a":"HP:0000716",
 *		"subsumer_label":"Abnormal emotion/affect behavior",
 *		"subsumer_id":"HP:0100851",
 *		"value":5.667960271407814,
 *		"label_b":"abnormal response to new environment",
 *		"id_b":"MP:0001413",
 *		"model_id":"MGI_006446",
 *		"model_label":"B10.Cg-H2<sup>h4</sup>Sh3pxd2b<sup>nee</sup>/GrsrJ",
 *		"rowid":"HP_0000716_HP_0100851"
 *	},
 *
 *	These results will then be rendered in the phenogrid
 */


// Will need to install jquery, jquery-ui, d3, jshashtable first via npm - Joe
// Note: jquery 2.1.0 is capable of using browserify's module.exports - Joe
// npm install jquery jquery-ui d3 jshashtable

// NPM installed packages, you will find them in /node_modules - Joe

// jquery  is commonsJS compliant as of 2.1.0 - Joe

require('jquery'); //  Browserify encapsulates every module into its own scope - Joe
require('jquery-ui');
var d3 = require('d3');
var Hashtable = require('jshashtable');


// load other non-npm dependencies - Joe
// need to specify the relative path ./ and .js extension
var model = require('./model.js');
var stickytooltip = require('./stickytooltip.js');
var TooltipRender = require('./tooltiprender.js');

(function(factory) {
	// If there is a variable named module and it has an exports property,
	// then we're working in a Node-like environment. Use require to load
	// the jQuery object that the module system is using and pass it in.
	// Otherwise, we're working in a browser, so just pass in the global jQuery object.
	if (typeof module === "object" && typeof module.exports === "object") {
		module.exports = factory(require("jquery"), window, document);
	} else {
		factory($, window, document);
	}
})

(function($, window, document, __undefined__) {
	var createPhenogridForElement = function(element, options) {
		var jqElement = $(element);
		jqElement.phenogrid(options);
	};

	window.Phenogrid = {
		createPhenogridForElement: createPhenogridForElement
	};

	// Use widget factory to define the UI plugin - Joe
	// Can aslo be ns.phenogrid (ns can be anything else - namespace) - Joe
	// Later can be called using $().phenogrid(); - Joe
	// Widget factory API documentation https://api.jqueryui.com/jquery.widget/ - Joe
	$.widget("ui.phenogrid", {
		// Why not prefixed with underscore? - Joe

		// core commit. Not changeable by options.

		// merged into this.state - Joe
		// only used twice, one of them is for config.h, which according to the comments, h should be elimiated - Joe
		// so we can just use one variable for all configs to contain everything in congig and internalOptions - Joe
		config: {
			imagePath: 'image/',
			htmlPath: 'js/res/',
			colorDomains: [0, 0.2, 0.4, 0.6, 0.8, 1], // liner gradient stop positions used by offset attribute - Joe
			// http://colorbrewer2.org/
			colorRanges: [ // each color sets the stop color based on the stop points in colorDomains - Joe
				'rgb(237,248,177)',
				'rgb(199,233,180)',
				'rgb(127,205,187)',
				'rgb(65,182,196)', 
				'rgb(29,145,192)',
				'rgb(34,94,168)'
			], // stop colors for corresponding stop points - Joe
			overviewCount: 3,
			colStartingPos: 10,
			detailRectStrokeWidth: 2,
			globalViewSize : 110, // overview map -Joe
			reducedGlobalViewSize: 50,
			minHeight: 310,
			h : 578,	// [vaa12] this number could/should be eliminated.  updateAxis sets it dynamically as it should be
			m :[ 30, 10, 10, 10 ],
			multiOrganismCt: 10,
			multiOrgModelLimit: 750,
			phenotypeSort: ["Alphabetic", "Frequency and Rarity", "Frequency" ], // Dropdown menu "Sort Phenotypes" - Joe
			similarityCalculation: [
				{label: "Similarity", calc: 0, high: "Max", low: "Min"},
				{label: "Ratio (q)", calc: 1, high: "More Similar", low: "Less Similar"},
				{label: "Ratio (t)", calc: 3, high: "More Similar", low: "Less Similar"} ,
				{label: "Uniqueness", calc: 2, high: "Highest", low: "Lowest"}
			],
			smallestModelWidth: 400,
			textLength: 34,
			textWidth: 200,
			w : 0,
			headerAreaHeight: 160,
			comparisonTypes: [{organism: "Homo sapiens", comparison: "diseases"}],
			defaultComparisonType: {comparison: "genes"},
			// speciesLabels Not used - Joe
			speciesLabels: [
				{abbrev: "HP", label: "Human"},
				{abbrev: "MP", label: "Mouse"},
				{abbrev: "ZFIN", label: "Zebrafish"},
				{abbrev: "ZP", label: "Zebrafish"},
				{abbrev: "FB", label: "Fly"},
				{abbrev: "GO", label: "Gene Ontology"},
				{abbrev: "UDP", label: "UDP Patients"}
			],
			dataDisplayCount: 30,
			labelCharDisplayCount : 20,
			apiEntityMap: [
				{prefix: "HP", apifragment: "disease"},
				{prefix: "OMIM", apifragment: "disease"}
			],
			defaultApiEntity: "gene",
			tooltips: {},
			widthOfSingleModel: 18,
			heightOfSingleModel: 18,
			yoffsetOver: 30,
			overviewGridTitleXOffset: 340,
			nonOverviewGridTitleXOffset: 220,
			gridTitleYOffset: 20,
			xOffsetOver: 20,
			baseYOffset: 150,
			dummyModelName: "dummy",
			// Do we need this? - Joe
			simServerURL: "",  // URL of the server for similarity searches
			preloadHPO: false	// Boolean value that allows for preloading of all HPO data at start.  If false, the user will have to manually select what HPO relations to load via hoverbox.
		},

		// Why not prefixed with underscore? - Joe

		// merged into this.state - Joe
		// only used once, so we can just use one variable to store all configs - Joe
		internalOptions: {
			/// good - legit options
			serverURL: "",
			// Do we need this? - Joe
			simServerURL: "",  // URL of the server for similarity searches
			simSearchQuery: "/simsearch/phenotype", // All HP ids are appended to this URL - Joe
			selectedCalculation: 0,
			invertAxis: false,
			hpoDepth: 10,	// Numerical value that determines how far to go up the tree in relations.
			hpoDirection: "OUTGOING",	// String that determines what direction to go in relations.  Default is "OUTGOING".
			hpoTreeAmounts: 1,	// Allows you to decide how many HPO Trees to render.  Once a tree hits the high-level parent, it will count it as a complete tree.  Additional branchs or seperate trees count as seperate items
								// [vaa12] DO NOT CHANGE UNTIL THE DISPLAY HPOTREE FUNCTIONS HAVE BEEN CHANGED. WILL WORK ON SEPERATE TREES, BUT BRANCHES MAY BE INACCURATE
			selectedSort: "Frequency",
			targetSpeciesName : "Overview",
			refSpecies: "Homo sapiens",
					targetSpeciesList : [
						{name: "Homo sapiens", taxon: "9606"},
						{name: "Mus musculus", taxon: "10090" },
						{name: "Danio rerio", taxon: "7955"},
						{name: "Drosophila melanogaster", taxon: "7227"},
						{name: "UDP", taxon: "UDP"}
					],
			// According to Harry, the genotype expand is not showing in current version - Joe
			genotypeExpandLimit: 5, // sets the limit for the number of genotype expanded on grid
			phenoCompareLimit: 10, // sets the limit for the number of phenotypes used for genotype expansion
			// COMPARE CALL HACK - REFACTOR OUT
			providedData: {}
		},




		// Methods begin with underscore are not callable from outside of the plugin - Joe




		// reset state values that must be cleared before reloading data
		_reset: function(type) {
			// LEAVE UNTIL OR MOVING HASH CONSTRUCTION EARLIER
			if (type === 'organism' || type === 'axisflip' || typeof(type) === 'undefined') {
				this.state.modelData = [];
				this.state.modelList = [];
				this.state.expandedHash = new Hashtable(); // used jshashtable.js - Joe
			}

			// target species name might be provided as a name or as taxon. Make sure that we translate to name
			this.state.targetSpeciesName = this._getTargetSpeciesNameByTaxon(this, this.state.targetSpeciesName);

			this.state.yAxisMax = 0;
			this.state.yoffset = this.state.baseYOffset;

			this.state.modelName = "";
			this.state.h = this.config.h; // the only use of config.h, can be removed according to comment - Joe
		},

		/*
		 * this function will use the desired height to determine how many phenotype rows to display
		 * the basic formula is: (height - headerAreaHeight)/14.
		 * return -1 if the available space is too small to properly display the grid
		 */
		_calcPhenotypeDisplayCount: function() {
			var self = this;

			var pCount = Math.round((self.state.h - self.state.headerAreaHeight) / 14); // why devide 14? - Joe
			if (pCount < 10) {
				pCount = -1;
			}
			return pCount;
		},

		// Several procedures for various aspects of filtering/identifying appropriate entries in the target species list..
		_getTargetSpeciesIndexByName: function(self, name) {
			var index = -1;
			if (typeof(self.state.targetSpeciesByName[name]) !== 'undefined') {
				// console.log(self.state.targetSpeciesByName);
				// will show that the index is a string instead of a number
				// Need to use parseInt() to convert string to int  - Joe
				index = parseInt(self.state.targetSpeciesByName[name].index);
			}
			return index;
		},

		_getTargetSpeciesNameByIndex: function(self,index) {
			var species;
			if (typeof(self.state.targetSpeciesList[index]) !== 'undefined') {
				species = self.state.targetSpeciesList[index].name;
			} else {
				species = 'Overview';
			}
			return species;
		},

		_getTargetSpeciesTaxonByName: function(self, name) {
			var taxon;
			// first, find something that matches by name
			if (typeof(self.state.targetSpeciesByName[name]) !== 'undefined') {
				taxon = self.state.targetSpeciesByName[name].taxon;
			}
			// default to overview, so as to always do something sensible
			if (typeof(taxon) === 'undefined') {
				taxon ='Overview';
			}

			return taxon;
		},

		/*
		* some installations might send in a taxon - "10090" - as opposed to a name - "Mus musculus".
		* here, we make sure that we are dealing with names by translating back
		* this might be somewhat inefficient, as we will later translate to taxon, but it will
		* make other calls easier to be consitently talking in terms of species name
		*/
		_getTargetSpeciesNameByTaxon: function(self, name) {
			// default - it actually was a species name
			var species = name;
			var found = false;

			/*
			 * check to see if the name exists.
			 * if it is found, then we say "true" and we're good.
			 * if, however, it matches the taxon, take the index in the array.
			 */

			for (var sname in self.state.targetSpeciesByName) {
				if ( ! self.state.targetSpeciesByName.hasOwnProperty(sname)) {
					break;
				}
				// we've found a matching name.
				if (name === sname) {
					found = true;
				}

				if (name === self.state.targetSpeciesByName[sname].taxon) {
					found = true;
					species = sname;
					break;
				}
			}
			// if not found, it's overview.
			if (found === false) {
				species = "Overview";
			}
			return species;
		},




		// _create() method is the widget's constructor, it is called for each element that the plugin method is called on - Joe




		// NOTE: I'm not too sure what the default init() method signature should be given an imageDiv and phenotype_data list
		/*
		 * imageDiv - the place you want the widget to appear
		 * phenotype_data - a list of phenotypes in the following format:
		 * [ {"id": "HP:12345", "observed" :"positive"}, {"id: "HP:23451", "observed" : "negative"},]
		 * or simply a list of IDs.
		 * [ "HP:12345", "HP:23451", ...]
		 */
		_create: function() {
			// must be available from js loaded in a separate file...
			// configoptions is defined in phenogrid_config.js - Joe

			// loaded into local scope, should just remove the phenogrid_config.js and have those config options coded in this file. - Joe
			this.configoptions = configoptions;
			// check these
			// important that config options (from the file) and this. options (from
			// the initializer) come last

			// jquery $.extend(): Merge the contents of two or more objects together into the first object - Joe
			// so now this.state contains all the config options - Joe
			this.state = $.extend({}, this.internalOptions, this.config, this.configoptions, this.options);

			// Added by Joe - Joe
			// simsearch returned data b[] is stored in this.state['data'] - Joe
			console.log(this.state);

			// default simServerURL value..
			if (typeof(this.state.simServerURL) === 'undefined' || this.state.simServerURL === '') {
				this.state.simServerURL = this.state.serverURL;
			}

			// contains all simsearch returned data - Joe
			this.state.data = {};

			// will this work?
			this.configoptions = undefined; // Did you want to reset this variable? Why only reset configoptions? - Joe

			this._createTargetSpeciesIndices();
			// index species
			this._reset();
		},

		// create a shortcut index for quick access to target species by name - to get index (position) and taxon
		_createTargetSpeciesIndices: function() {
			this.state.targetSpeciesByName = {};
			for (var j in this.state.targetSpeciesList) {
				if ( ! this.state.targetSpeciesList.hasOwnProperty(j)) {
					break;
				}
				// list starts as name, taxon pairs
				var name = this.state.targetSpeciesList[j].name;
				var taxon = this.state.targetSpeciesList[j].taxon;
				var entry = {};
				entry.index = j;
				entry.taxon = taxon;
				this.state.targetSpeciesByName[name] = entry;
			}
		},

		/*
		 * HACK WARNING - 20140926, harryh@pitt.edu
		 * phenogrid assumes a path of /js/res relative to the scriptpath directory. This will contain configuration files
		 * that will be loaded via urls constructed in this function.
		 * As of 9/26/2014, the puptent application used in monarch-app breaks this.
		 * thus, a workaround is included below to set the path correctly if it come up as '/'.
		 * this should not impact any standalone uses of phenogrid, and will be removed once monarch-app is cleaned up.
		 */

		/*
		 * HACK WARNING - 20150713, dan@quantumclay.com
		 * 	The serverURL corresponds to a running Monarch server that can provide 'help text'
		 * 	for a possibly separate Monarch server's UI. This enables the user (typically, a developer)
		 * 	to point to a more authoritative server for help text.
		 *	As we transition from the /widgets/phenogrid model to the /node_modules/phenogrid model,
		 *	we may end up pointing from a more recent /node_modules server to an older /widgets/phenogrid
		 *	server, in which case we need to adjust the path.
		 * 	Once all the authoritative servers (e.g., beta.monarchinitiative.org) have been upgraded to use
		 *	node_modules, then this can be simplified.
		 *	Currently, the existence of an explicit serverUrl (non-blank) is used to indicate that the
		 *	workaround is necessary.
		 */

		 /*
		 * HACK WARNING - 20150715, zhy19@pitt.edu
		 * 	Added htmlPath to refer to the relative path to those FAQ html pages
		 * 	To make it work with monarch-app, also need to add htmlPath in monarch-appjs/phenogridloader-no-species.js
		 *  This way, both ifrmae and npm version of phenogrid on monarch-app will show the FAQ popup content
		 *	Without adding this htmlPath in monarch-appjs/phenogridloader-no-species.js, the iframe page won't work
		 */
		_getResourceUrl: function(name, type) {
			return this.state.htmlPath + name + '.' + type;
		},



		// initialization, distinct from creation - Joe



		//init is now reduced down completely to loading
		_init: function() {
			this.element.empty();

			// show loading spinner - Joe
			this._showLoadingSpinner();
			
			// original spot for init of tooltip
			this.state.phenoDisplayCount = this._calcPhenotypeDisplayCount();
			// save a copy of the original phenotype data
			// The slice() method returns the selected elements in an array, as a new array object.
			// The original array will not be changed
			this.state.origPhenotypeData = this.state.phenotypeData.slice();

			// target species name might be provided as a name or as taxon. Make sure that we translate to name
			this.state.targetSpeciesName = this._getTargetSpeciesNameByTaxon(this, this.state.targetSpeciesName);
			this.state.phenotypeData = this._filterPhenotypeResults(this.state.phenotypeData);

			this._loadData();

			this._setLoadedValues();

			this._processDisplay();
		},

		// Loading spinner image from font awesome - Joe
		_showLoadingSpinner: function() {
			var element = $('<div>Loading Phenogrid Widget...<i class="fa fa-spinner fa-pulse"></i></div>');
			this._createSvgContainer();
			element.appendTo(this.state.svgContainer);
		},
		
		//Originally part of _init
		_setLoadedValues: function() {
			// must init the stickytooltip here initially, but then don't reinit later until in the redraw
			// this is weird behavior, but need to figure out why later
			if (typeof(this.state.stickyInitialized) === 'undefined') {
				this._addStickyTooltipAreaStub();
				this.state.stickyInitialized = true;
				stickytooltip.init("*[data-tooltip]", "mystickytooltip");
			}

			this.state.tooltipRender = new TooltipRender(this.state.serverURL);

			if (this.state.owlSimFunction === 'exomiser') {
				this.state.selectedCalculation = 2; // Force the color to Uniqueness
			}

			this._setSelectedCalculation(this.state.selectedCalculation);
			this._setSelectedSort(this.state.selectedSort);


			this.state.w = this.state.m[1] - this.state.m[3];
			this.state.currXIdx = this.state.dataDisplayCount;
			this.state.currYIdx = this.state.dataDisplayCount;
			this.state.modelDisplayCount = this.state.dataDisplayCount;
			this.state.phenoDisplayCount = this.state.dataDisplayCount;

			// original position of hpo cache and load data

			this.state.phenoLength = this.state.phenotypeListHash.size();
			this.state.modelLength = this.state.modelListHash.size();
			this._setAxisValues();

			// shorthand for top of model region
			this.state.yModelRegion = this.state.yoffsetOver + this.state.yoffset;

			// copy the phenotypeArray to phenotypeData array - now instead of ALL phenotypes, it will be limited to unique phenotypes for this disease
			// do not alter this array: this.state.phenotypeData

			this._adjustPhenotypeCount();
			this._adjustModelCount();
			this.state.currXIdx = this._getXLimit();
			this.state.currYIdx = this._getYLimit();
			this._createColorScale();
		},

		_reDraw: function() {
			if (this.state.phenoLength !== 0 && this.state.filteredModelData.length !== 0) {
				var displayCount = this._getYLimit();
				this._setComparisonType();
				this._initCanvas();
				this._addLogoImage();

				this.state.svg
					.attr("width", "100%")
					.attr("height", displayCount * this.state.widthOfSingleModel);
				var rectHeight = this._createRectangularContainers();

				this._addPhenogridControls();

				this._createXRegion();
				this._createYRegion();
				this._updateAxes();

				this._addGradients();

				this._createGridlines();
				this._createModelRects();
				this._highlightSpecies();

				this._createOverviewSection();

				var height = rectHeight + 40;

				// [vaa12] 15 prevents the control panel from overlapping the grid. Find way to remove magic num
				var containerHeight = height + 15;
				$("#pg_svg_area").css("height", height);
				$("#pg_svg_container").css("height", containerHeight);

				// this must be initialized here after the _createModelLabels, or the mouse events don't get
				// initialized properly and tooltips won't work with the mouseover defined in _convertLableHTML
				stickytooltip.init("*[data-tooltip]", "mystickytooltip");

			} else {
				this._createSvgContainer();
				this.state.svgContainer.append("Error: No results available! Please reload this widget later.");
			}
			// COMPARE CALL HACK - REFACTOR OUT
			// no organism selector if we are doing the 'compare' function
			if (this.state.owlSimFunction === 'compare' || this.state.owlSimFunction === 'exomiser') {
				this.state.svg.select("#pg_specieslist").remove();
				this.state.svg.select("#faqinfo").remove();
				$("#pg_org_div").remove();
			}
		},

		// Returns the correct limit amount for the X axis based on axis position
		_getXLimit: function () {
			if (this.state.invertAxis) {
				return this.state.phenoDisplayCount;
			} else {
				return this.state.modelDisplayCount;
			}
		},

		// Returns the correct limit amount for the Y axis based on axis position
		_getYLimit: function () {
			if (this.state.invertAxis) {
				return this.state.modelDisplayCount;
			} else {
				return this.state.phenoDisplayCount;
			}
		},



		// https://api.jqueryui.com/jquery.widget/#method-_setOption - Joe


		/* dummy option procedures as per
		 * http://learn.jquery.com/jquery-ui/widget-factory/how-to-use-the-widget-factory/
		 * likely to have some content added as we proceed
		 */
		_setOption: function(key, value) {
			this._super( key, value );
		},

		_setOptions: function(options) {
			this._super( options );
		},

		// adds light gray gridlines to make it easier to see which row/column selected matches occur
		_createGridlines: function() {
			var self = this;
			var mWidth = self.state.widthOfSingleModel;
			var mHeight = self.state.heightOfSingleModel;
			// create a blank grid to match the size of the phenogrid grid
			var data = [];
			var rowCt = self._getYLimit();
			var colCt = self._getXLimit();

			for (var k = 0; k < rowCt; k++){
				for (var l = 0; l < colCt; l++) {
					var r = [];
					r.push(k);
					r.push(l);
					data.push( r );
				}
			}
			self.state.svg.selectAll("rect.bordered")
				.data(data)
				.enter()
				.append("rect")
				.attr("id", "pg_gridline")
				.attr("transform", "translate(254, " + (this.state.yModelRegion + 5) + ")") // position the pg_gridline net to region - Joe
				.attr("x", function(d, i) {
					return d[1] * mWidth;
				})
				.attr("y", function(d, i) {
					return d[0] * mHeight;
				})
				.attr("class", "hour bordered deselected")
				.attr("width", 14)
				.attr("height", 14);
		},

		// Sets the X & Y axis hash datastructures correctly based on axis position
		_setAxisValues: function() {
			// By default, X = Models and Y = Phenotypes.  Same goes for xID and yID in the modelData structures
			// This is reversed for when invertAxis is true
			if (this.state.invertAxis) {
				this.state.xAxis = this.state.phenotypeListHash;
				this.state.yAxis = this.state.modelListHash;
			} else {
				this.state.xAxis = this.state.modelListHash;
				this.state.yAxis = this.state.phenotypeListHash;
			}
		},

		// For the selection area, see if you can convert the selection to the idx of the x and y then redraw the bigger grid
		_createOverviewSection: function() {
			var self = this;
			var axisStatus = this.state.invertAxis;
			var yCount = self._getYLimit();
			var xCount = self._getXLimit();

			var startYIdx = this.state.currYIdx - yCount;
			var startXIdx = this.state.currXIdx - xCount;

			// add-ons for stroke size on view box. Preferably even numbers
			var linePad = 2;
			var viewPadding = linePad * 2 + 2;

			// overview region is offset by xTranslation, yTranslation
			var xTranslation = 42;
			var yTranslation = 30;

			// these translations from the top-left of the rectangular region give the absolute coordinates
			var overviewX = self.state.axis_pos_list[2] + xTranslation;
			var overviewY = self.state.yModelRegion + yTranslation;

			// size of the entire region - it is a square
			var overviewRegionSize = self.state.globalViewSize;
			if (this.state.yAxis.size() < yCount) {
				overviewRegionSize = self.state.reducedGlobalViewSize;
			}

			// make it a bit bigger to ccont for widths
			var overviewBoxDim = overviewRegionSize + viewPadding;

			// create the main box and the instruction labels.
			self._initializeOverviewRegion(overviewBoxDim, overviewX, overviewY);

			// create the scales
			self._createSmallScales(overviewRegionSize);

			// add the items using smaller rects
			var modData = self._mergeHashEntries(self.state.modelDataHash);

			var model_rects = this.state.svg.selectAll(".mini_models")
				.data(modData, function(d) {
					return d.yID + d.xID;
				});
			overviewX++;	// Corrects the gapping on the sides
			overviewY++;
			var modelRectTransform = "translate(" + overviewX +	"," + overviewY + ")";

			model_rects.enter()
				.append("rect")
				.attr("transform", modelRectTransform)
				.attr("class", "mini_model")
				.attr("y", function(d, i) {
					return self.state.smallYScale(d.yID) + linePad / 2;
				})
				.attr("x", function(d) {
					return self.state.smallXScale(d.xID) + linePad / 2;
				})
				.attr("width", linePad)
				.attr("height", linePad)
				.attr("fill", function(d) {
					var colorID;
					if (axisStatus) {
						colorID = d.yID;
					} else {
						colorID = d.xID;
					}
					return self._getColorForModelValue(self, d.value[self.state.selectedCalculation]);
				});

			var lastYId = self._returnID(this.state.yAxis, yCount - 1);
			var lastXId = self._returnID(this.state.xAxis, xCount - 1);
			var startYId = self._returnID(this.state.yAxis, startYIdx);
			var startXId = self._returnID(this.state.xAxis, startXIdx);

			var selectRectX = self.state.smallXScale(startXId);
			var selectRectY = self.state.smallYScale(startYId);
			var selectRectHeight = self.state.smallYScale(lastYId);
			var selectRectWidth = self.state.smallXScale(lastXId);

			self.state.highlightRect = self.state.svg.append("rect")
				.attr("x", overviewX + selectRectX)
				.attr("y", overviewY + selectRectY)
				.attr("id", "pg_selectionrect") // id of the draggable shaded rect - Joe
				.attr("height", selectRectHeight + 4)
				.attr("width", selectRectWidth + 4)
				.attr("class", "draggable")
				.call(d3.behavior.drag().on("drag", function(d) {
						/*
						 * drag the highlight in the overview window
						 * notes: account for the width of the rectangle in my x and y calculations
						 * do not use the event x and y, they will be out of range at times. Use the converted values instead.
						 */
						var current = d3.select(this);
						var curX = parseFloat(current.attr("x"));
						var curY = parseFloat(current.attr("y"));

						var rect = self.state.svg.select("#pg_selectionrect");

						rect.attr("transform", "translate(0, 0)"); // May not need this - Joe

						// limit the range of the x value
						var newX = curX + d3.event.dx;
						var newY = curY + d3.event.dy;

						// Restrict Movement if no need to move map
						if (selectRectHeight === overviewRegionSize) {
							newY = overviewY;
						}
						if (selectRectWidth === overviewRegionSize) {
							newX = overviewX;
						}

						// block from going out of bounds on left
						if (newX < overviewX) {
							newX = overviewX;
						}
						// top
						if (newY < overviewY) {
							newY = overviewY;
						}
						// right
						if (newX + selectRectWidth > overviewX + overviewRegionSize) {
							newX = overviewX + overviewRegionSize - selectRectWidth;
						}

						// bottom
						if (newY + selectRectHeight > overviewY + overviewRegionSize) {
							newY = overviewY + overviewRegionSize - selectRectHeight;
						}
						rect.attr("x", newX);
						// This changes for vertical positioning
						rect.attr("y", newY);

						// adjust x back to have 0,0 as base instead of overviewX, overviewY
						newX = newX - overviewX;
						newY = newY - overviewY;

						// invert newX and newY into positions in the model and phenotype lists.
						var j = self._invertOverviewDragPosition(self.state.smallXScale, newX);
						var newXPos = j + xCount;

						var jj = self._invertOverviewDragPosition(self.state.smallYScale, newY);
						var newYPos = jj + yCount;

						self._updateModel(newXPos, newYPos);
			}));
			// set this back to 0 so it doesn't affect other rendering
		},

		// Returns the ID of the value on the Y Axis based on current position provided
		_returnID: function(hashtable,position) {
			var searchArray = hashtable.entries();
			var results = false;
			for (var i in searchArray){
				if ( ! searchArray.hasOwnProperty(i)) {
					break;
				}
				if (searchArray[i][1].pos === position) {
					results = searchArray[i][0];
					break;
				}
			}
			return results;
		},

		// When a hashtable is pass through, it will merge the key into the values and return an array with all needed info.
		// Mainly used for D3 and it's unabilty to read non-native data structures
		_mergeHashEntries: function(hashT){
			var premerged = hashT.entries();
			var merged = [];
			for (var i in premerged){
				if ( ! premerged.hasOwnProperty(i)){break;}
				if (typeof(premerged[i][0].yID) !== 'undefined') {
					premerged[i][1].yID = premerged[i][0].yID;
					premerged[i][1].xID = premerged[i][0].xID;
				} else {
					premerged[i][1].id = premerged[i][0];
				}
				merged[i] = premerged[i][1];
			}
			return merged;
		},


		// One color scale shared by all species - Joe
		_getColorForModelValue: function(self, score) {
			// This is for the new "Overview" target option
			var selectedScale = self.state.colorScale[self.state.selectedCalculation];
			return selectedScale(score);
		},

		// model scores legend is not created after flipping the widget - Joe
		_createModelScoresLegend: function() {
			// Make sure the legend is only created once - Joe
			if (this.state.svg.select(".pg_tip")[0][0] === null) {
				var self = this;
				var scoreTipY = self.state.yoffset;
				var faqY = scoreTipY - self.state.gridTitleYOffset;
				var tipTextLength = 92;
				var explYOffset = 15;
				var explXOffset = 10;

				var scoretip = self.state.svg.append("text")
					.attr("transform", "translate(" + (self.state.axis_pos_list[2] ) + "," + scoreTipY + ")")
					.attr("x", 0)
					.attr("y", 0)
					.attr("class", "pg_tip")
					.text("<- Model Scores"); // changed "<" to "<-" to make it look more like an arrow pointer - Joe

				var tip	= self.state.svg
					.append("text")
					.attr('font-family', 'FontAwesome')
					.text(function(d) {
						return '\uF05A\n'; // Need to convert HTML/CSS unicode to javascript unicode - Joe
					})
					.attr("id", "modelscores")
					.attr("x", self.state.axis_pos_list[2] + tipTextLength)
					.attr("y", faqY + 20) // 20 padding - Joe
					.style('cursor', 'pointer')
					.on("click", function(d) {
						self._showDialog("modelscores");
					});

				var expl = self.state.svg.append("text")
					.attr("x", self.state.axis_pos_list[2] + explXOffset)
					.attr("y", scoreTipY + explYOffset)
					.attr("class", "pg_tip")
					.text("Best matches high to low"); // uppercased best - > Best - Joe
			}

		},

		// Overview navigation - Joe
		_initializeOverviewRegion: function(overviewBoxDim, overviewX, overviewY) {
			var self = this;
			// rectangular border for overview
			var globalview = self.state.svg.append("rect")
				.attr("x", overviewX)
				.attr("y", overviewY)
				.attr("id", "pg_globalview")
				.attr("height", overviewBoxDim)
				.attr("width", overviewBoxDim);

			var overviewInstructionHeightOffset = 50;
			var lineHeight = 12;

			// There's better way to create this two-line text - Joe
			// SVG 1.2 supports textarea, not all browsers support it though - Joe

			var y = self.state.yModelRegion + overviewBoxDim + overviewInstructionHeightOffset;
			var rect_instructions = self.state.svg.append("text")
				.attr("x", self.state.axis_pos_list[2] + 10)
				// This changes for vertical positioning
				.attr("y", y)
				.attr("class", "pg_instruct")
				.text("Use the phenotype map above to");

			rect_instructions = self.state.svg.append("text")
				.attr("x", self.state.axis_pos_list[2] + lineHeight)
				// This changes for vertical positioning
				.attr("y", y + 10)
				.attr("class", "pg_instruct")
				.text("navigate the model view on the left");
		},

		_createSmallScales: function(overviewRegionSize) {
			var self = this;
			var sortDataList = [];
			var mods = [];
			sortDataList = self._getSortedIDList(self.state.yAxis.entries());

			mods = self._getSortedIDList(self.state.xAxis.entries());

			this.state.smallYScale = d3.scale.ordinal()
				.domain(sortDataList.map(function (d) {
					return d;
				}))
				.rangePoints([0,overviewRegionSize]);

			var modids = mods.map(function (d) {
				return d;
			});
			this.state.smallXScale = d3.scale.ordinal()
				.domain(modids)
				.rangePoints([0,overviewRegionSize]);
		},

		// Returns an sorted array of IDs from an arrayed Hashtable, but meant for non-overview display based off pos
		// [vaa12] the reason there are two different ones is how phenogrid prefers displays. _getSortedID can display items that have a pos
		// between 7-37 and keep them numbered as such, where in strict, it will reset 7 to 0, so they will be numbered 0-30
		_getSortedIDList: function(hashArray) {
			var resultArray = [];
			for (var j in hashArray) {
				if ( ! hashArray.hasOwnProperty(j)) {
					break;
				}
				resultArray[hashArray[j][1].pos] = hashArray[j][0];
			}
			return resultArray;
		},

		// Returns an sorted array of IDs from an arrayed Hashtable, but meant for non-overview display based off an previous sort
		// Best for filtered display, as it sets the lowest value to 0 and increases from there
		_getSortedIDListStrict: function (hashArray) {
			var firstSort = this._getSortedIDList(hashArray);
			var resultArray = [];
			for (var j in firstSort) {
				if ( ! firstSort.hasOwnProperty(j)) {
					break;
				}
				resultArray.push(firstSort[j]);
			}
			return resultArray;
		},

		_invertOverviewDragPosition: function(scale, value) {
			var leftEdges = scale.range();
			var size = scale.rangeBand();
			var j;
			for (j = 0; value > (leftEdges[j] + size); j++) {}
			// iterate until leftEdges[j]+size is past value
			return j;
		},

		_getComparisonType: function(organism) {
			var label = "";

			for (var i in this.state.comparisonTypes) {
				if (organism === this.state.comparisonTypes[i].organism) {
					label = this.state.comparisonTypes[i].comparison;
				}
			}
			if (label === '') {
				label = this.state.defaultComparisonType.comparison;
			}
			return label;
		},

		_setComparisonType: function(){
			var comp = this.state.defaultComparisonType;
			for (var i in this.state.comparisonTypes) {
				if ( ! this.state.comparisonTypes.hasOwnProperty(i)) {
					break;
				}
				if (this.state.targetSpeciesName === this.state.comparisonTypes[i].organism) {
					comp = this.state.comparisonTypes[i];
				}
			}
			this.state.comparisonType = comp;
		},

		_setSelectedCalculation: function(calc) {
			var self = this;

			var tempdata = self.state.similarityCalculation.filter(function(d) {
				return d.calc == calc;
			});
			self.state.selectedCalculation = tempdata[0].calc;
		},

		_setSelectedSort: function(type) {
			var self = this;
			self.state.selectedSort = type;
		},

		// Previously processSelected
		_processDisplay: function(){
			this._sortPhenotypeHash();
			this._filterDisplay();
			this.state.unmatchedPhenotypes = this._getUnmatchedPhenotypes();
			this.element.empty();
			this._reDraw();
		},

		// given the full dataset, return a filtered dataset containing the
		// subset of data bounded by the phenotype display count and the model display count
		_adjustPhenotypeCount: function() {
			// we need to adjust the display counts and indexing if there are fewer phenotypes than the default
			if (this.state.phenoLength < this.state.phenoDisplayCount) {
				this.state.phenoDisplayCount = this.state.phenoLength;
			}
		},

		_adjustModelCount: function() {
			// we need to adjust the display counts and indexing if there are fewer models
			if (this.state.modelLength < this.state.modelDisplayCount) {
				this.state.modelDisplayCount = this.state.modelLength;
			}
		},

		// Previously filterSelected
		_filterDisplay: function() {
			var self = this;
			var axis_idx = 0;
			var sortedYArray = [];

			var	startYIdx = this.state.currYIdx - this._getYLimit();
			var	displayYLimiter = this.state.currYIdx;
			var	startXIdx = this.state.currXIdx - this._getXLimit();
			var	displayXLimiter = this.state.currXIdx;

			this.state.filteredYAxis = self._filterListHash(this.state.yAxis,startYIdx,displayYLimiter);
			this.state.filteredXAxis = self._filterListHash(this.state.xAxis,startXIdx,displayXLimiter);

			sortedYArray = self._getSortedIDListStrict(self.state.filteredYAxis.entries());

			for (var i in sortedYArray) {
				if ( ! sortedYArray.hasOwnProperty(i)) {
					break;
				}
				// update the YAxis
				// the height of each row
				var size = 10;
				// the spacing you want between rows
				var gap = 8;
				// push the rowid and ypos onto the yaxis array
				// so now the yaxis will be in the order of the ranked phenotypes
				var ypos = (axis_idx * (size + gap)) + self.state.yoffset;
				self._setYPosHash(sortedYArray[i], ypos);
				axis_idx++;
			}

			self._filterHashTables();
		},

		// given a list of phenotypes, find the top n models
		// I may need to rename this method "getModelData". It should extract the models and reformat the data
		_loadData: function() {

			/*
			 * set the owlsimFunction
			 * there are three possibilities
			 * 'undefined' is the basic, traditional simsearch
			 * 'compare' goes against specific subsets genes/genoetypes
			 * 'exomiser' calls the exomiser for the input data.
			 * COMPARE CALL HACK - REFACTOR OUT
			 */

			if (typeof this.state.owlSimFunction === 'undefined') {
				this.state.owlSimFunction = 'search';
			} else if (this.state.owlSimFunction === 'compare' || this.state.owlSimFunction === 'exomiser') {
				this.state.targetSpeciesName = 'Homo sapiens';
			}

			if ( ! this.state.hpoCacheBuilt) {
				this.state.hpoCacheHash = new Hashtable(); // jshashtable.js - Joe
				this.state.hpoCacheLabels = new Hashtable();
			}

			this.state.expandedHash = new Hashtable();  // for cache of genotypes
			this.state.phenotypeListHash = new Hashtable();
			this.state.modelListHash = new Hashtable();
			// Create a new empty hash table with supplied options, Hashtable(Object options) - Joe
			// hashCode: A function that provides hash codes for keys placed in the hash table.
			// equals: A function that checks for equality between two keys with the same hash code.
			//this.state.modelDataHash = new Hashtable({hashCode: this.model.modelDataPointPrint, equals: this.model.modelDataPointEquals});
			this.state.modelDataHash = new Hashtable({hashCode: model.modelDataPointPrint, equals: model.modelDataPointEquals});


			// [vaa12] determine if is wise to preload datasets for the three species and then build overview from this
			// At time being, overview is made up of three calls, which it repeats these calls with a larger limit if you decided to view single species
			// Might be more efficent to load those three, cache them and then make an overview dataset and cache that as well.
			// This is also called when axis is flipped, so might need to create those cached as well (which would be very simple)
			if (this.state.targetSpeciesName === 'Overview') {
				this._loadOverviewData();
				this._finishOverviewLoad();
			} else {
				this._loadSpeciesData(this.state.targetSpeciesName);
				// [vaa12] line below can be used to force a different limit.  It can be loaded above the API default (100) but has a
				// noticable time delay when trying to load.  There may be a conflict at the API level when trying to go higher than default
				//this._loadSpeciesData(this.state.targetSpeciesName,20);
				this._finishLoad();
			}

			this.state.hpoCacheBuilt = true;
		},

		_loadSpeciesData: function(speciesName, limit) {
			var phenotypeList = this.state.phenotypeData;
			var taxon = this._getTargetSpeciesTaxonByName(this,speciesName);
			var res;
			var postData;
			//console.log("this.state.simServerURL is..."+this.state.simServerURL);
			// COMPARE CALL HACK - REFACTOR OUT
			if ($.isEmptyObject(this.state.providedData)) {
				var url = this._getLoadDataURL(phenotypeList, taxon, limit);
				
                // NOTE: Here we configure calls to simsearch to be a POST, while calls
				// to the compare function use a GET, the reason being that compare calls
				// are not yet configured for POST in the monarch-app.  Configuring the compare
				// function to handle a post will simplify this code
				
                if (this.state.owlSimFunction !== 'compare'){
                    postData = 'input_items='+ phenotypeList.join("+") + "&target_species=" + taxon;
                    if (typeof(limit) !== 'undefined') {
                        postData += "&limit=" + limit;
                    }
                    url = this.state.simServerURL + this.state.simSearchQuery;
                    res = this._ajaxPostData(speciesName, url, postData);
                } else {
                    res = this._ajaxLoadData(speciesName,url);
                }
			} else {
				res = this.state.providedData;
			}

			if (typeof (res) !=='undefined' && res !== null) {
				if (typeof(limit) !== 'undefined' && typeof(res.b) !== 'undefined' && res.b !== null && res.b.length < limit) {
					res = this._padSpeciesData(res,speciesName,limit);
				}
			}
			this.state.data[speciesName] = res;
		},


		_getLoadDataURL : function(phenotypeList, taxon, limit) {
			var url = this.state.simServerURL; // do we need state.simServerURL? - Joe
			// COMPARE CALL HACK - REFACTOR OUT
			switch(this.state.owlSimFunction) {
				case ('compare'):
					url = url+'/compare/'+ phenotypeList.join("+") + "/" + this.state.geneList.join(',');
					break;
				default:
					url = url+ this.state.simSearchQuery + phenotypeList.join("+") + "&target_species=" + taxon;
					if (typeof(limit) !== 'undefined') {
						url += "&limit=" + limit;
					}
					break;
			}
			return url;
		},

		/*
		 * Make sure there are limit items in res --
		 * If we don't have enough, add some dummy items in.
		 * This will space things out appropriately, having dummy models take
		 * up some of the x axis space. Later, we will make sure not to show the labels for these dummies.
		 */
		_padSpeciesData: function(res, species, limit) {
			var toadd = limit - res.b.length;
			for (var i = 0; i < toadd; i++) {
				var dummyId = "dummy" + species + i;
				var newItem = {
					id: dummyId,
					label: this.state.dummyModelName,
					score: {score: 0, rank: Number.MAX_VALUE},
					taxon: {id: dummyId, label: this.state.dummyModelName}
				};
				res.b.push(newItem);
			}
			return res;
		},

		_loadOverviewData: function() {
			var limit = this.state.multiOrganismCt;
			for (var i in this.state.targetSpeciesList) {
				if ( ! this.state.targetSpeciesList.hasOwnProperty(i)) {
					break;
				}
				var species = this.state.targetSpeciesList[i].name;
				this._loadSpeciesData(species, limit);
				if (species === this.state.refSpecies && typeof(species) !== 'undefined') {
				// if it's the one we're reffering to
					if (typeof(this.state.data[species].metadata) !== 'undefined') {
						this.state.maxICScore = this.state.data[species].metadata.maxMaxIC;
					}
				}
				else {
					var data = this.state.data[species];
					if(typeof(data) !== 'undefined' && data.length < limit) {
						limit = (limit - data.length);
					}
				}
			}
		},

		_finishOverviewLoad: function () {
			var speciesList = [];
			var posID = 0;
			var type, ID, hashData;
			var variantNum = 0;

			for (var i in this.state.targetSpeciesList) {
				if ( ! this.state.targetSpeciesList.hasOwnProperty(i)) {
					break;
				}
				var species = this.state.targetSpeciesList[i].name;
				var specData = this.state.data[species];
				if (specData !== null && typeof(specData.b) !== 'undefined' && specData.b.length > 0) {
					for (var idx in specData.b) {
						if(!specData.b.hasOwnProperty(i)){break;}
						var item = specData.b[idx];
						ID = this._getConceptId(item.id);

						// [vaa12] HACK.  NEEDED FOR ALLOWING MODELS OF THE SAME ID AKA VARIANTS TO BE DISPLAYED W/O OVERLAP
						// SEEN MOST WITH COMPARE AND/OR EXOMISER DATA
						if (this.state.modelListHash.containsKey(ID)) {
							ID += "_" + variantNum;
							variantNum++;
						}

						type = this.state.defaultApiEntity;
						for (var j in this.state.apiEntityMap) {
							if ( ! this.state.apiEntityMap.hasOwnProperty(i)) {
								break;
							}
							if (ID.indexOf(this.state.apiEntityMap[j].prefix) === 0) {
								type = this.state.apiEntityMap[j].apifragment;
							}
						}

						hashData = {
							"label": item.label,
							"species": species,
							"taxon": item.taxon.id,
							"type": type,
							"pos": parseInt(posID),
							"rank": parseInt(idx),
							"score": item.score.score
						};
						// use put(key, value) to add a key/value pair to the hashtable, and get() to retrieve a value - Joe
						this.state.modelListHash.put(ID, hashData);
						this._loadDataForModel(ID, item);
						posID++;
					}
					this.state.multiOrganismCt = specData.b.length;
					speciesList.push(species);
				}
			}

			this.state.speciesList = speciesList;
		},

		/*
		 * Finish the data load after the ajax request
		 * Create the modelList array: model_id, model_label, model_score, model_rank
		 * Call _loadDataForModel to put the matches in an array
		 */
		_finishLoad: function() {
			var species = this.state.targetSpeciesName;
			var retData = this.state.data[species];
			var hashData, ID, type, z;
			var variantNum = 0;

			if (typeof(retData) ==='undefined'  || retData === null) {
				return;
			}
			// extract the maxIC score
			if (typeof (retData.metadata) !== 'undefined') {
				this.state.maxICScore = retData.metadata.maxMaxIC;
			}

			if (typeof (retData.b) !== 'undefined') {
				for (var idx in retData.b) {
					if(!retData.b.hasOwnProperty(idx)) {
						break;
					}
					var item = retData.b[idx];
					ID = this._getConceptId(item.id);

					// [vaa12] HACK.  NEEDED FOR ALLOWING MODELS OF THE SAME ID AKA VARIANTS TO BE DISPLAYED W/O OVERLAP
					// SEEN MOST WITH COMPARE AND/OR EXOMISER DATA
					if (this.state.modelListHash.containsKey(ID)) {
						ID += "_" + variantNum;
						variantNum++;
					}

					type = this.state.defaultApiEntity;
					for (var j in this.state.apiEntityMap) {
						if( ! this.state.apiEntityMap.hasOwnProperty(j)) {
							break;
						}
						if (ID.indexOf(this.state.apiEntityMap[j].prefix) === 0) {
							type = this.state.apiEntityMap[j].apifragment;
						}
					}

					hashData = {"label": item.label, "species": species, "taxon": item.taxon.id, "type": type, "pos": parseInt(idx), "rank": parseInt(idx), "score": item.score.score};
					this.state.modelListHash.put(ID, hashData);
					this._loadDataForModel(ID, item);
				}
			}
		},

		/*
		 * For a given model, extract the sim search data including IC scores and the triple:
		 * The a column, b column, and lowest common subsumer for the triple's IC score, use the LCS score
		 */
		_loadDataForModel: function(modelID, newModelData) {
			// data is an array of all model matches
			var data = newModelData.matches;
			var curr_row, lcs, modelPoint, hashData;
			if (typeof(data) !== 'undefined' && data.length > 0) {

				for (var idx in data) {
					if( ! data.hasOwnProperty(idx)) {
						break;
					}
					curr_row = data[idx];
					lcs = this._normalizeIC(curr_row);

					if ( ! this.state.phenotypeListHash.containsKey(this._getConceptId(curr_row.a.id))) {
						hashData = {"label": curr_row.a.label, "IC": parseFloat(curr_row.a.IC), "pos": 0, "count": 0, "sum": 0, "type": "phenotype"};
						this.state.phenotypeListHash.put(this._getConceptId(curr_row.a.id), hashData);
						if ( ! this.state.hpoCacheBuilt && this.state.preloadHPO) {
							this._getHPO(this._getConceptId(curr_row.a.id));
						}
					}

					// Setting modelDataHash
					if (this.state.invertAxis) {
						modelPoint = new model.modelDataPoint(this._getConceptId(curr_row.a.id), this._getConceptId(modelID));
					} else {
						modelPoint = new model.modelDataPoint(this._getConceptId(modelID), this._getConceptId(curr_row.a.id));
					}
					this._updateSortVals(this._getConceptId(curr_row.a.id), parseFloat(curr_row.lcs.IC));

					// simsearch returns array b:[{}...] with all the matched results. Each item in array b is an object
					// that contains: id, label, matches[], score{}, taxon{}, and type. - Joe

					hashData = {
						"value": lcs,
						"subsumer_label": curr_row.lcs.label,
						"subsumer_id": this._getConceptId(curr_row.lcs.id),
						"subsumer_IC": parseFloat(curr_row.lcs.IC),
						"b_label": curr_row.b.label,
						"b_id": this._getConceptId(curr_row.b.id),
						"b_IC": parseFloat(curr_row.b.IC)
					};

					this.state.modelDataHash.put(modelPoint, hashData);
				}
			}
		},

		// Different methods of based on the selectedCalculationMethod
		_normalizeIC: function(datarow){
			var aIC = datarow.a.IC;
			var bIC = datarow.b.IC;
			var lIC = datarow.lcs.IC;
			var nic;

			var ics = new Array(3);

			// 0 - similarity
			nic = Math.sqrt((Math.pow(aIC - lIC, 2)) + (Math.pow(bIC - lIC, 2)));
			nic = (1 - (nic / + this.state.maxICScore)) * 100;
			ics[0] = nic;

			// 1 - ratio(q)
			nic = ((lIC / aIC) * 100);
			ics[1] = nic;

			// 2 - uniquenss
			nic = lIC;
			ics[2] = nic;

			// 3 - ratio(t)
			nic = ((lIC / bIC) * 100);
			ics[3] = nic;

			return ics;
		},

		// Will update the position of the phenotype based on sort
		_updatePhenoPos: function(key,rank) {
			var values = this.state.phenotypeListHash.get(key);
			values.pos = rank;
			this.state.phenotypeListHash.put(key,values);
		},

		// Sets the correct position for the value on the yAxis on where it belongs in the grid/axis
		_setYPosHash: function(key,ypos) {
			var values = this.state.yAxis.get(key);
			values.ypos = ypos;
			this.state.yAxis.put(key, values);
		},

		// Updates the count & sum values used for sorting
		_updateSortVals: function(key,subIC) {
			var values;
			values = this.state.phenotypeListHash.get(key);
			values.count += 1;
			values.sum += subIC;
			this.state.phenotypeListHash.put(key, values);
		},

		// Returns values from a point on the grid
		_getCellData: function(point) {
			if (this.state.modelDataHash.containsKey(point)) {
				return this.state.modelDataHash.get(point);
			} else {
				return false;
			}
		},

		// Returns axis data from a ID of models or phenotypes
		_getAxisData: function(key) {
			if (this.state.yAxis.containsKey(key)) {
				return this.state.yAxis.get(key);
			} else if (this.state.xAxis.containsKey(key)) {
				return this.state.xAxis.get(key);
			} else {
				return false;
			}
		},

		// Determines if an ID belongs to the Model or Phenotype hashtable
		_getIDType: function(key) {
			if (this.state.modelListHash.containsKey(key)) {
				return 'Model';
			} else if (this.state.phenotypeListHash.containsKey(key)) {
				return 'Phenotype';
			} else {
				return false;
			}
		},

		_getIDTypeDetail: function(key) {
			var info = this.state.modelListHash.get(key);

			if (info !== null) {
				return info.type;
			}
			return "unknown";
		},

		// Creates the filteredModelData data structure
		_filterHashTables: function () {
			var newFilteredModel = [];
			var currentModelData = this.state.modelDataHash.entries();

			for (var i in currentModelData){
				if ( ! currentModelData.hasOwnProperty(i)) {
					break;
				}
				if (this.state.filteredXAxis.containsKey(currentModelData[i][0].xID) && this.state.filteredYAxis.containsKey(currentModelData[i][0].yID)) {
					currentModelData[i][1].yID = currentModelData[i][0].yID;
					currentModelData[i][1].xID = currentModelData[i][0].xID;
					newFilteredModel.push(currentModelData[i][1]);
				}
			}
			this.state.filteredModelData = newFilteredModel;
		},

		// Filters down the axis hashtables based on what the limits are
		_filterListHash: function (hash,start,end) {
			var filteredHash = new Hashtable();
			var oldHash = hash.entries();

			for (var i in oldHash){
				if ( ! oldHash.hasOwnProperty(i)) {
					break;
				}
				if (oldHash[i][1].pos >= start && oldHash[i][1].pos < end) {
					filteredHash.put(oldHash[i][0],oldHash[i][1]);
				}
			}

			return filteredHash;
		},

		// Sorts the phenotypes
		_sortPhenotypeHash: function () {
			var self = this;
			var sortType = self.state.selectedSort;
			var sortFunc;
			var newHash = [];
			var origHash = self.state.phenotypeListHash.entries();
			for (var i in origHash){
				if(!origHash.hasOwnProperty(i)){break;}
				newHash.push({
					"id": origHash[i][0],
					"label": origHash[i][1].label.toLowerCase(),
					"count": origHash[i][1].count,
					"sum": origHash[i][1].sum}
				);
			}
			if (sortType === 'Frequency') {
				sortFunc = self._sortPhenotypesModelHash;
			} else if (sortType === 'Frequency and Rarity') {
				sortFunc = self._sortPhenotypesRankHash;
			} else if (sortType === 'Alphabetic') {
				sortFunc = self._sortPhenotypesAlphabeticHash;
			}

			if (typeof(sortFunc) !== 'undefined') {
				newHash.sort(sortFunc);
				for (var j in newHash){
					if ( ! newHash.hasOwnProperty(j)) {
						break;
					}
					self._updatePhenoPos(newHash[j].id, Number(j));
				}
			}
		},

		_sortPhenotypesModelHash: function(a, b) {
			var diff = b.count - a.count;
			if (diff === 0) {
				diff = a.id.localeCompare(b.id);
			}
			return diff;
		},

		_sortPhenotypesRankHash: function(a, b) {
			return b.sum-a.sum;
		},

		_sortPhenotypesAlphabeticHash: function(a, b) {
			var labelA = a.label,
			labelB = b.label;
			if (labelA < labelB) {
				return -1;
			}
			if (labelA > labelB) {
				return 1;
			}
			return 0;
		},

		// generic ajax call for all queries
		_ajaxLoadData: function(target, url) { // removed space between function and the ( - Joe
			var self = this;
			var res;
			$.ajax({
				url: url,
				async : false,
				dataType : 'json',
				success : function(data) {
					res = data;
				},
				error: function(xhr, errorType, exception) { // removed space between function and the ( - Joe
				    console.log('Server error.');
				}
			});
			return res;
		},
		
        // generic ajax POST
        _ajaxPostData: function (target, url, postData) {
            var self = this;
            var res;
            $.ajax({
                url: url,
                method: 'POST',
                data: postData,
                async : false,
                dataType : 'json',
                success : function(data) {
                    res = data;
                },
                error: function (xhr, errorType, exception) {
                // Triggered if an error communicating with server
                    self._displayResult(xhr, errorType, exception);
                }
             });
            return res;
        },

		_createColorScale: function() {
			var maxScore = 0,
			method = this.state.selectedCalculation; // 4 different calculations (similarity, ration (q), ratio (t), uniqueness) - Joe

			switch(method){
				case 2: maxScore = this.state.maxICScore; // Uniqueness ? - Joe
				break;
				case 1: maxScore = 100;
				break;
				case 0: maxScore = 100;
				break;
				case 3: maxScore = 100;
				break;
				default: maxScore = this.state.maxICScore;
				break;
			}
			// 3 september 2014 still a bit clunky in handling many organisms, but much less hardbound.
			this.state.colorScale = {};


			this.state.colorScale = new Array(4); // Why 4? Maybe one color scale per calculation method? - Joe
			for (var j = 0; j < 4; j++) {
				maxScore = 100;
				if (j === 2) {
					maxScore = this.state.maxICScore; // Uniqueness ? - Joe
				}
				if (typeof(this.state.colorRanges[j]) !== 'undefined') {
					this.state.colorScale[j] = this._getColorScale(maxScore);
				}
			}
		},

		// One color scale shared by all species - Joe
		_getColorScale: function(maxScore) {
			var cs = d3.scale.linear();
			cs.domain([3, maxScore]);
			cs.domain(this.state.colorDomains.map(cs.invert));
			cs.range(this.state.colorRanges);
			return cs;
		},

		_initCanvas: function() {
			this._createSvgContainer();
			var svgContainer = this.state.svgContainer;
			svgContainer.append("<svg id='pg_svg_area'></svg>");
			this.state.svg = d3.select("#pg_svg_area");
			this._addGridTitle();

		},

		// widget container - Joe
		_createSvgContainer: function() {
			var svgContainer = $('<div id="pg_svg_container"></div>');
			this.state.svgContainer = svgContainer;
			this.element.append(svgContainer);
		},

		// NEW - add a sticky tooltip div stub, this is used to dynamically set a tooltip for gene info and expansion
		_addStickyTooltipAreaStub: function() {
			var sticky = $("<div>")
							.attr("id", "mystickytooltip")
							.attr("class", "stickytooltip");

			var inner1 = $("<div>")
							.attr("style", "padding:5px");

			var atip =  $("<div>")
							.attr("id", "sticky1")
							.attr("class", "atip");

			var img = $("<img>")
					.attr("id", "img-spinner")
					.attr("src", this.state.imagePath + "waiting_ac.gif")
					.attr("alt", "Loading, please wait...");

			var wait = $("<div>")
				.attr("id", "wait")
				//.attr("class", "spinner")
				.attr("style", "display:none")
				.text("Searching for data...");

				wait.append(img);
			var status = $("<div>")
				.attr("class", "stickystatus");

			inner1.append(wait).append(atip);

			sticky.append(inner1);
					//.append(wait);
					//.append(status);

			// always append to body
			sticky.appendTo('body');
				sticky.mouseleave("mouseout", function(e) {
				//console.log("sticky mouse out. of sticky.");
				stickytooltip.closetooltip();
			});
		},

		_addGridTitle: function() {
			var self = this;
			var species = '';

			// set up defaults as if overview
			var xoffset = this.state.overviewGridTitleXOffset;
			var titleText = "Cross-Species Overview";

			if (this.state.targetSpeciesName !== 'Overview') {
				species= this.state.targetSpeciesName;
				xoffset = this.state.nonOverviewGridTitleXOffset;
				var comp = this._getComparisonType(species);
				titleText = "Phenotype Comparison (grouped by " + species + " " + comp + ")";
			}
			// COMPARE CALL HACK - REFACTOR OUT
			if (this.state.owlSimFunction === 'compare' || this.state.owlSimFunction === 'exomiser') {
				titleText = "Phenotype Comparison";
			}

			var mtitle = this.state.svg.append("svg:text")
				.attr("class", "gridtitle")
				.attr("id", "pg_toptitle")
				.attr("x", xoffset)
				.attr("y", this.state.gridTitleYOffset)
				.text(titleText);

			var faq	= this.state.svg
				.append("text")
				.attr('font-family', 'FontAwesome')
				.attr("id", "pg_faqs")
				.attr("x", 90 + 90)	// Logo width + padding
				.attr("y", 20)		// Half logo height
				.text(function(d) {
					return "\uf05a"; // Need to convert HTML/CSS unicode to javascript unicode - Joe
				})
				.style('cursor', 'pointer')
				.on("click", function(d) {
					self._showDialog("faq");
				});

		},

		_configureFaqs: function() {
			var self = this;
			var sorts = $("#pg_sorts")
				.on("click", function(d, i) {
					self._showDialog("sorts");
				});

			//var calcs = d3.selectAll("#calcs")
			var calcs = $("#pg_calcs")
				.on("click", function(d) {
					self._showDialog("calcs");
				});
		},

		_resetSelections: function(type) {
			var self = this;

			$("#pg_svg_area").remove();

			if (type === 'organism') {
				// The slice() method returns the selected elements in an array, as a new array object.
				// The original array will not be changed
				self.state.phenotypeData = self.state.origPhenotypeData.slice();
				self._reset("organism");
				self._init();
			} else if (type === "calculation") {
				self._reset("calculation");
			} else if (type === "sortphenotypes") {
				self._reset("sortphenotypes");
			} else if (type === "axisflip") {
				// The slice() method returns the selected elements in an array, as a new array object.
				// The original array will not be changed
				self.state.phenotypeData = self.state.origPhenotypeData.slice();
				self._reset("axisflip");
				self._init();
			}
		},

		// Monarch Logo - Joe
		_addLogoImage:	 function() {
			this.state.svg.append("svg:image")
				.attr("xlink:href", this.state.imagePath + "logo.png")
				.attr("id", "pg_logo")
				.attr("x", 0)
				.attr("y", 0)
				.attr("width", 90)
				.attr("height", 46);
		},

		_resetLinks: function() {
			var link_lines = d3.selectAll(".phenotype_label");
			for (var i in link_lines[0]) {
				if ( ! link_lines[0].hasOwnProperty(i)) {
					break;
				}
				link_lines[0][i].style.fill = this._getExpandStyling(link_lines[0][i].id);
			}

			link_lines.style("font-weight", "normal");
			link_lines.style("text-anchor", "end");

			var link_labels = d3.selectAll(".model_label");
			for (var j in link_labels[0]){
				if ( ! link_lines[0].hasOwnProperty(j)) {
					break;
				}
				link_labels[0][j].style.fill = this._getExpandStyling(link_labels[0][j].id);
			}
			link_labels.style("font-weight", "normal");
		},

		// Will return all partial matches in the modelDataHash structure.  Good for finding rows/columns of data
		_getMatchingModels: function (key) {
			var modelKeys = this.state.modelDataHash.keys();
			var matchingKeys = [];
			for (var i in modelKeys) {
				if ( ! modelKeys.hasOwnProperty(i)) {
					break;
				}
				if (key === modelKeys[i].yID || key === modelKeys[i].xID) {
					matchingKeys.push(modelKeys[i]);
				}
			}
			return matchingKeys;
		},

		// Merging of both Highlight model and phenotype functions
		_highlightMatching: function(curr_data) {
			var self = this;
			var alabels, label, ID;
			var dataType = self._getIDType(curr_data);
			var models = self._getMatchingModels(curr_data);
			var highlightX = false;

			if (dataType === "Phenotype") {
				if (this.state.invertAxis) {
					alabels = this.state.svg.selectAll("text.phenotype_label");
					highlightX = true;
				} else {
					alabels = this.state.svg.selectAll("text.model_label");
				}
			} else if (dataType === "Model") {
				if (this.state.invertAxis) {
					alabels = this.state.svg.selectAll("text.model_label");
				} else {
					alabels = this.state.svg.selectAll("text.phenotype_label");
					highlightX = true;
				}
			}

			for (var i in models){
				if ( ! models.hasOwnProperty(i)) {
					break;
				}
				if (highlightX) {
					ID = models[i].yID;
				} else {
					ID = models[i].xID;
				}

				label = self._getAxisData(ID).label;
				if (label === undefined){
					label = ID;
				}

				for (var j in alabels[0]){
					if ( ! alabels[0].hasOwnProperty(j)) {
						break;
					}
					if (alabels[0][j].id === ID) {
						alabels[0][j].style.fill = "blue";
					}
				}
			}
		},

		// Merging of both deselect model and phenotype functions
		_deselectMatching: function(curr_data) {
			var self = this;
			var dataType = self._getIDType(curr_data);
			var label, alabels, shortTxt, shrinkSize;
			if (dataType === "Phenotype") {
				if (this.state.invertAxis) {
					alabels = this.state.svg.selectAll("text.phenotype_label");
					shrinkSize = self.state.textLength;
				} else {
					alabels = this.state.svg.selectAll("text.model_label");
					shrinkSize = self.state.labelCharDisplayCount;
				}
			} else if (dataType === 'Model') {
				if (this.state.invertAxis) {
					alabels = this.state.svg.selectAll("text.model_label");
					shrinkSize = self.state.labelCharDisplayCount;
				} else {
					alabels = this.state.svg.selectAll("text.phenotype_label");
					shrinkSize = self.state.textLength;
				}
			} else {
				alabels = this.state.svg.selectAll("text.phenotype_label");
				shrinkSize = self.state.textLength;

				// Clear both axis.  One here, one below
				var blabels = this.state.svg.selectAll("text.model_label");
				for (var i in blabels[0]){
					if ( ! blabels[0].hasOwnProperty(i)) {
						break;
					}
					label = this._getAxisData(blabels[0][i].id).label;
					shortTxt = this._getShortLabel(label, self.state.labelCharDisplayCount);
					if (blabels[0][i].innerHTML == shortTxt) {
						blabels[0][i].style.fill = this._getExpandStyling(blabels[0][i].id); //"black";
					}
				}
			}

			for (var j in alabels[0]) {
				if ( ! alabels[0].hasOwnProperty(j)) {
					break;
				}
				label = this._getAxisData(alabels[0][j].id).label;
				shortTxt = this._getShortLabel(label, shrinkSize);
				if (alabels[0][j].innerHTML == shortTxt) {
					alabels[0][j].style.fill = this._getExpandStyling(alabels[0][j].id); //"black";
				}
			}
		},

		// Will capitalize words passed or send back undefined incase error
		_capitalizeString: function(word) {
			if (word === undefined) {
				return "Undefined";
			} else if (word === null) {
				return "";
			} else {
				return word.charAt(0).toUpperCase() + word.slice(1);
			}
		},

		_selectXItem: function(data, obj) {
			// HACK: this temporarily 'disables' the mouseover when the stickytooltip is docked
			// that way the user doesn't accidently hover another label which caused tooltip to be refreshed
			if (stickytooltip.isdocked) {
				return;
			}

			var self = this;
			var info = self._getAxisData(data);
			var displayCount = self._getYLimit();
			var concept = self._getConceptId(data);
			//console.log("selecting x item.."+concept);
			var appearanceOverrides;

			// Show that model label is selected. Change styles to bold, blue and full-length label
			var model_label = self.state.svg.selectAll("text#" + concept)
				.style("font-weight", "bold")
				.style("fill", "blue");

			appearanceOverrides = self._createHoverBox(data);   // TODO:we may want to rethink using this return value override

			// create the related model rectangles
			var highlight_rect = self.state.svg.append("svg:rect")
				.attr("transform","translate(" + (self.state.textWidth + self.state.xOffsetOver + 34.5) + "," + self.state.yoffsetOver + ")")
				.attr("x", function(d) {
					return (self.state.xScale(data) - 1);
				})
				.attr("y", self.state.yoffset + 3)
				.attr("class", "pg_col_accent")
				.attr("width", 15 * appearanceOverrides.offset)
				.attr("height", (displayCount * self.state.heightOfSingleModel));

			// obj is try creating an ojbect with an attributes array including "attributes", but I may need to define getAttrbitues
			// just create a temporary object to pass to the next method...
			obj = {
				attributes: [],
				getAttribute: function(keystring) {
					var ret = self.state.xScale(data) + 15;
					if (keystring == 'y') {
						ret = Number(self.state.yoffset - 100);
					}
					return ret;
				},
			};
			obj.attributes.transform = {value: highlight_rect.attr("transform")};
			self._highlightMatching(data);
		},

		// Previously _selectData
		_selectYItem: function(curr_data, obj) {
			var appearanceOverrides;
			// create a highlight row
			if (stickytooltip.isdocked) {
				return;
			}

			var self = this;
			var info = self._getAxisData(curr_data);

			//console.log("select y item.. "+txt);

			var alabels = this.state.svg.selectAll("text.phenotype_label." + curr_data)
				//.style("font-weight", "bold")
				.style("fill", "blue");

			appearanceOverrides = self._createHoverBox(curr_data);

			// create the related row rectangle
			var highlight_rect = self.state.svg.append("svg:rect")
				.attr("transform","translate(" + (self.state.axis_pos_list[1]) + "," + (self.state.yoffsetOver + 4) + ")")
				.attr("x", 12)
				.attr("y", function(d) {
					return info.ypos + 2.5; // magic number - Joe
				}) //rowid
				.attr("class", "pg_row_accent")
				.attr("width", this.state.modelWidth - 4)
				.attr("height", 11 * appearanceOverrides.offset);

			this._highlightMatching(curr_data);

			//stickytooltip.show(evt);
		},

		_createHoverBox: function(data) {
			var appearanceOverrides = {offset: 1, style: "pg_col_accent"}; // may use this structure later, offset is only used now
			var info = this._getAxisData(data);
			var type = info.type;
			if (type === undefined){
				type = this._getIDType(data);
			}

			var concept = this._getConceptId(data);

			// format data for rendering in a tooltip
			var retData = this.state.tooltipRender.html({parent: this, id:concept, data: info});

			// update the stub stickytool div dynamically to display
			$("#sticky1").empty();
			$("#sticky1").html(retData);

			// For phenotype HPO tree 
			if (type === 'phenotype') {
				// https://api.jqueryui.com/jquery.widget/#method-_on
				// Binds click event to the HPO tree expand icon - Joe
				// In tooltiprender.js, the font awesome icon <i> element follows the form of id="expandHPO_HP_0001300" - Joe
				var expandHPO_icon = $('#expandHPO_' + concept);
				this._on(expandHPO_icon, {
					"click": function(event) {
						this._expandHPO(concept);
					}
				});
				
				// Binds click event to the HPO tree collapse icon - Joe
				// In tooltiprender.js, the font awesome icon <i> element follows the form of id="collapseHPO_HP_0001300" - Joe
				var expandHPO_icon = $('#collapseHPO_' + concept);
				this._on(expandHPO_icon, {
					"click": function(event) {
						this._collapseHPO(concept);
					}
				});
			}

			// not really good to do this but, we need to be able to override some appearance attributes
			return appearanceOverrides;
		},


		// Added for grid cell mouse over tooltip - Joe
		_createHoverBoxForCell: function(data) {
			// format data for rendering in a tooltip
			var retData = this.state.tooltipRender.html({parent: this, data: data});

			// update the stub stickytool div dynamically to display
			$("#sticky1").empty();
			$("#sticky1").html(retData);
		},
		

		// Why not prefixed with underscore? - Joe

		// This builds the string to show the relations of the HPO nodes.  It recursively cycles through the edges and in the end returns the full visual structure displayed in the phenotype hover
		buildHPOTree: function(id, edges, level) {
			var results = "";
			var nextResult;
			var nextLevel = level + 1;

			for (var j in edges){
				if ( ! edges.hasOwnProperty(j)) {
					break;
				}
				// Currently only allows subClassOf relations.  When new relations are introduced, it should be simple to implement
				if (edges[j].pred == "subClassOf" && this.state.hpoTreesDone != this.state.hpoTreeAmounts) {
					if (edges[j].sub == id) {
						if (this.state.hpoTreeHeight < nextLevel){
							this.state.hpoTreeHeight++;
						}

						nextResult = this.buildHPOTree(edges[j].obj, edges, nextLevel);
						if (nextResult === '') {
							// Bolds the 'top of the line' to see what is the root or closet to the root.  It will hit this point either when it reaches the hpoDepth or there is no parents
							results += "<br/>" + this._buildIndentMark(this.state.hpoTreeHeight - nextLevel) + "<strong>" + this._buildHPOHyperLink(edges[j].obj) + "</strong>";
							this.state.hpoTreesDone++;
						} else {
							results += nextResult + "<br/>" + this._buildIndentMark(this.state.hpoTreeHeight - nextLevel) + this._buildHPOHyperLink(edges[j].obj);
						}

						if (level === 0) {
							results += "<br/>" + this._buildIndentMark(this.state.hpoTreeHeight) + this.state.hpoCacheLabels.get(id) + "<br/>";
							this.state.hpoTreeHeight = 0;
						}
					}
				}
			}
			return results;
		},

		_buildIndentMark: function (hpoTreeHeight) {
			var indent = "<em class='HPO_tree_indent'></em>";

			if (hpoTreeHeight === 0) {
				return indent;
			}

			for (var i = 1; i < hpoTreeHeight; i++){
				indent += "<em class='HPO_tree_indent'></em>";
			}

			return indent + '&#8627'; // HTML entity - Joe
		},

		// Based on the ID, it pulls the label from hpoCacheLabels and creates a hyperlink that allows the user to go to the respective phenotype page
		_buildHPOHyperLink: function(id) {
			var label = this.state.hpoCacheLabels.get(id);
			var link = "<a href=\"" + this.state.serverURL + "/phenotype/" + id + "\" target=\"_blank\">" + label + "</a>";
			return link;
		},

		// Previously _deselectData + _clearModelData
		_deselectData: function (data) {
			var self = this;
			this.state.svg.selectAll(".pg_row_accent").remove();
			this.state.svg.selectAll(".pg_col_accent").remove();
			this._resetLinks();

			if (data !== undefined) {
				var IDType = this._getIDType(data);
				var alabels;

				// IDType can be false - Joe
				if (IDType) {
					var id = this._getConceptId(data);
					var label = this._getAxisData(data).label;

					if ((IDType === "Phenotype" && !this.state.invertAxis) || (IDType === "Model" && this.state.invertAxis)) {
						alabels = this.state.svg.selectAll("text.phenotype_label." + id);
						alabels.html(this._getShortLabel(label));
					} else if ((IDType === "Phenotype" && this.state.invertAxis) || (IDType === "Model" && !this.state.invertAxis)) {
						alabels = this.state.svg.selectAll("text#" + id);
						alabels.html(this._getShortLabel(label, self.state.labelCharDisplayCount));
					}

					alabels.style("font-weight", "normal");
					alabels.style("fill", "black");

					this._deselectMatching(data);
				}
			}
			//stickytooltip.closetooltip();
		},

		_clickItem: function(url_origin, data) {
			var url;
			var apientity = this.state.defaultApiEntity;
			if (this._getIDType(data) === "Phenotype") {
				url = url_origin + "/phenotype/" + (data.replace("_", ":"));
				var win = window.open(url, '_blank');

			} else if (this._getIDType(data) === "Model"){
				apientity = this._getIDTypeDetail(data);

				// if it's overview, then just allow view of the model clicked
				if (this.state.targetSpeciesName !== "Overview" && apientity === 'gene') {
					// TEMP: THIS HIDES THE GENOTYPE EXPANSION STUFF FOR NOW
					//var expanded = this._isExpanded(data);
					//if (expanded !== null && expanded) {
					// 	this._collapseGenotypes(data);
					//} else if (expanded !== null && !expanded){
					// 	this._expandGenotypes(data);
					//}
				}
			} else {
				console.log ("URL CLICK ERROR");
			}
		},

		// return a label for use in the list. This label is shortened to fit within the space in the column
		_getShortLabel: function(label, newlength) {
			if (label !== undefined) {
				var retLabel = label;
				if ( ! newlength) {
					newlength = this.state.textLength;
				}
				if (label.length > newlength) {
					retLabel = label.substring(0, newlength-3) + "...";
				}
				return retLabel;
			}else {
				return "Unknown";
			}
		},

		/*
		 * This method extracts the unique id from a given URI for example, http://www.berkeleybop.org/obo/HP:0003791 would return HP:0003791
		 * Why? Two reasons. First it's useful to note that d3.js doesn't like to use URI's as ids.
		 * Second, I like to use unique ids for CSS classes. This allows me to selectively manipulate related groups of items on the
		 * screen based their relationship to a common concept (ex: HP000123). However, I can't use a URI as a class.
		 */
		_getConceptId: function(uri) {
			//if (!uri) {
			//	return "";
			//}
			//var startpos = uri.lastIndexOf("/");
			//var len = uri.length;

			// remove the last > if there is one

			//var endpos = uri.indexOf(">") == len-1 ? len-1 : len;
			//var retString = uri + "";
			//if (startpos != -1) {
			//	retString = uri.substring(startpos+1,endpos);
			//}

			// replace spaces with underscores. Classes are separated with spaces so a class called "Model 1" will be two classes: Model and 1. Convert this to "Model_1" to avoid this problem.
			var retString = uri;
			try {
				retString = retString.replace(" ", "_");
				retString = retString.replace(":", "_");
				return retString;
			} catch (exception) {}
		},

		_convertLabelHTML: function (self, t, label, data) {
			self = this;
			var width = 100,
			el = d3.select(t),
			p = d3.select(t.parentNode),
			x = +t.getAttribute("x"),
			y = +t.getAttribute("y");

			// this fixes the labels that are html encoded
			label = this._decodeHtmlEntity(label);

			p.append("text")
				.attr('x', x + 15)
				.attr('y', y)
				.attr("width", width)
				.attr("id", this._getConceptId(data))
				.attr("model_id", data)
				.attr("height", 60)
				.attr("transform", function(d) {
					return "rotate(-45)";
				})
				.on("click", function(d) {
					self._clickItem(self.state.serverURL, data);
				})
				.on("mouseover", function(d, event) {
					var evt = event || window.event;
					//console.log(evt);
					self._selectXItem(data, this);
				})
				.on("mouseout", function(d) {
					self._deselectData(data);
				})
				.attr("class", this._getConceptId(data) + " model_label")
				.attr("data-tooltip", "sticky1")
				// this activates the stickytool tip
				.style("font-size", "12px")
				//.style("font-weight", "bold")
				.style("fill", this._getExpandStyling(data))
				// don't show the label if it is a dummy.
				.text(function(d) {
					if (label === self.state.dummyModelName) {
						return "";
					} else {
						return label;
					}});

			// put a little icon indicator in front of the label
			if (this._hasChildrenForExpansion(data)) {
				p.append("image")
				.attr('x', x-3)
				.attr('y', y-10)
				.attr('width', 9)
				.attr('height', 9)
				.attr('xlink:href', this.state.imagePath + 'downarrow.png');
			} else if (this._isGenoType(data)) {
				p.append("image")
				.attr('x', x-3)
				.attr('y', y-10)
				.attr('width', 9)
				.attr('height', 9)
				.attr('xlink:href', this.state.imagePath + '.checkmark-drk.png');
			}

			el.remove();
		},

		// extract the x,y values from a SVG transform string (ex: transform(200,20))
		_extractTransform: function(dataString) {
			var startIdx = dataString.indexOf("(");
			var commaIdx = dataString.indexOf(",");
			var x_data = Number(dataString.substring(startIdx+1, commaIdx));
			var y_data = Number(dataString.substring(commaIdx+1, dataString.length-1));
			return { x: x_data, y: y_data};
		},

		/*
		 * The the "SVG" XY position of an element
		 * The mouse position returned by d3.mouse returns the poistion within the page, not the SVG
		 * area. Therefore, this is a two step process: retreive any transform data and the (x,y) pair.
		 * Return the (x,y) coordinates with the transform applied
		 */
		_getXYPos: function(obj) {
			var tform = { x: 0, y: 0};
			// if a transform exisits, apply it
			if (typeof obj.attributes.transform != 'undefined') {
				var transform_str = obj.attributes.transform.value;
				tform = this._extractTransform(transform_str);
			}
			return {x: Number(obj.getAttribute("x")) + tform.x, y: Number(obj.getAttribute("y")) + tform.y};
		},

		/*
		 * NOTE: I need to find a way to either add the model class to the phenotypes when they load OR
		 * select the rect objects related to the model and append the class to them.
		 * something like this: $( "p" ).addClass( "myClass yourClass" );
		 */
		_createModelRects: function() {
			var self = this;
			var data = this.state.filteredModelData;
			var axisStatus = this.state.invertAxis;

			var rectTranslation = "translate(" + ((this.state.textWidth + this.state.xOffsetOver + 30) + 4) + "," + (self.state.yoffsetOver + 15)+ ")";
			var model_rects = this.state.svg.selectAll(".cell")
				.data(data, function(d) {
					return d.xID + d.yID;
				});

			model_rects.enter()
				.append("rect")
				.attr("transform", rectTranslation) // moves the data cells to region - Joe
				.attr("class", 'cell')
				.attr("id", function(d) { // e.g. id="cell_MGI_98331_HP_0000739" - Joe
					var dConcept = (d.xID + '_' + d.yID);
					var modelConcept = self._getConceptId(d.xID);
					// append the model id to all related items
					if (d.value[self.state.selectedCalculation] > 0) {
						var bla = self.state.svg.selectAll(".phenotype_label." + dConcept);
						bla.classed(modelConcept, true);
					}

					return "cell_" + dConcept;
				})
				.attr("y", function(d, i) {
					return self._getAxisData(d.yID).ypos + self.state.yoffsetOver;
				})
				.attr("x", function(d) {
					return self.state.xScale(d.xID);
				})
				.attr("width", 10) // size of each cube - Joe
				.attr("height", 10)
				.attr("data-tooltip", "sticky1") // Tooptip on mouseover - Joe
				// I need to pass this into the function
				.on("mouseover", function(d) {
					this.parentNode.appendChild(this);

					self._highlightIntersection(d, d3.mouse(this));
					self._enableRowColumnRects(this);

					self._createHoverBoxForCell(d);
				})
				.on("mouseout", function(d) {
					// De-highlight row and column
					self.state.svg.selectAll(".pg_row_accent").remove();
					self.state.svg.selectAll(".pg_col_accent").remove();

					// Reset model label
					var model_label = self.state.svg.selectAll("#" + self._getConceptId(d.xID));
					model_label.style("font-weight", "normal");
					model_label.style("fill", "black");

					// Reset phenotype label
					var phenotype_label = self.state.svg.selectAll("#" + self._getConceptId(d.yID));
					phenotype_label.style("font-weight", "normal");
					phenotype_label.style("fill", "black");
					
					stickytooltip.closetooltip(); // Close the tooltip - Joe
				})
			.attr("fill", function(d) {
				var colorID;
				if (axisStatus) {
					colorID = d.yID;
				} else {
					colorID = d.xID;
				}
				// The calculated color of the data model cell - Joe
				return self._getColorForModelValue(self, d.value[self.state.selectedCalculation]);
			});

			// removed transition effect for a clean animation - Joe
			model_rects
				.attr("y", function(d) {
					return self._getAxisData(d.yID).ypos - 8; // y position of the cubes region - Joe
				})
				.attr("x", function(d) {
					return self.state.xScale(d.xID) + 2; // x position of the cubes region - Joe
				});

			model_rects.exit().remove();
		},

		_highlightSpecies: function() {
			// create the related model rectangles
			var self = this;
			var list = [];
			var ct, width, height, borderStroke;
			var vwidthAndGap = self.state.heightOfSingleModel;
			var hwidthAndGap = self.state.widthOfSingleModel;
			var totCt = 0;
			var parCt = 0;
			var displayCount = self._getYLimit();
			var displayCountX = self._getXLimit();

			// Have temporarly until fix for below during Axis Flip
			if (self.state.targetSpeciesName == 'Overview') {
				if (this.state.invertAxis) {
					list = self.state.speciesList;
					ct = self.state.multiOrganismCt;
					borderStroke = self.state.detailRectStrokeWidth / 2;
					width = hwidthAndGap * displayCountX + 4; // magin number 4 makes the width a little wider - Joe
					height = vwidthAndGap * ct + borderStroke;
				} else {
					list = self.state.speciesList;
					ct = self.state.multiOrganismCt;
					borderStroke = self.state.detailRectStrokeWidth;
					width = hwidthAndGap * ct + 4; // magin number 4 makes the width a little wider - Joe
					height = vwidthAndGap * displayCount + borderStroke * 2;
				}
			} else {
				list.push(self.state.targetSpeciesName);
				ct = displayCountX;
				borderStroke = self.state.detailRectStrokeWidth;
				width = hwidthAndGap * ct + 4; // magin number 4 makes the width a little wider - Joe
				height = vwidthAndGap * displayCount + borderStroke * 2;
			}

			var border_rect = self.state.svg.selectAll(".species_accent")
				.data(list)
				.enter()
				.append("rect")
				.attr("transform", "translate(" + (self.state.textWidth + self.state.xOffsetOver + 30) + "," + (self.state.yoffsetOver) + ")")
				.attr("class", "species_accent")
				.attr("width", width)
				.attr("height", height)
				.attr("stroke", "#333") // border color of the main data models region - Joe
				.attr("stroke-width", borderStroke)
				.attr("fill", "none"); // Has to specify fill and use none - Joe

				if (self.state.targetSpeciesName == 'Overview' && this.state.invertAxis) {
					border_rect.attr("x", 0);
					border_rect.attr("y", function(d, i) {
						totCt += ct;
						if (i === 0) {
							return (self.state.yoffset + borderStroke);
						} else {
							parCt = totCt - ct;
							return (self.state.yoffset + borderStroke) + ((vwidthAndGap) * parCt + i);
						}
					});
				} else if (self.state.targetSpeciesName == 'Overview' && ! this.state.invertAxis) {
					border_rect.attr("x", function(d, i) {
						totCt += ct;
						if (i === 0) {
							return 0;
						} else if (i === 1) {
							return width - 2;
						} else if (i === 2) {
							return width *2 - 4; // Magic numbers to move the position - Joe
						}

						else {
							parCt = totCt - ct;
							return hwidthAndGap * parCt;
						}
					})
					.attr("width", hwidthAndGap * ct + 1); // magic number 1 makes the width a little wider - Joe

					border_rect.attr("y", self.state.yoffset + 1);
				} else {
					border_rect.attr("x", function(d, i) {
						totCt += ct;
						if (i === 0) {
							return 0;
						}
						else {
							parCt = totCt - ct;
							return hwidthAndGap * parCt;
						}
					});
					border_rect.attr("y", self.state.yoffset + 1);
				}
		},

		_enableRowColumnRects: function(curr_rect) {
			var self = this;

			var model_rects = self.state.svg.selectAll("rect.cell")
				.filter(function(d) {
					return d.rowid == curr_rect.__data__.rowid;
				});
			for (var i in model_rects[0]){
				if ( ! model_rects[0].hasOwnProperty(i)) {
					break;
				}
				model_rects[0][i].parentNode.appendChild(model_rects[0][i]);
			}
			var data_rects = self.state.svg.selectAll("rect.cell")
				.filter(function(d) {
					return d.model_id == curr_rect.__data__.model_id;
				});
			for (var j in data_rects[0]){
				if ( ! data_rects[0].hasOwnProperty(j)) {
					break;
				}
				data_rects[0][j].parentNode.appendChild(data_rects[0][j]);
			}
		},

		_highlightIntersection: function(curr_data, obj) {
			var self = this;
			var displayCount = self._getYLimit();
			// Highlight Row
			var highlight_rect = self.state.svg.append("svg:rect")
				.attr("transform", "translate(" + (self.state.axis_pos_list[1] + 2) + ","+ (self.state.yoffsetOver + 6 ) + ")") // position control -Joe
				.attr("x", 12)
				.attr("y", function(d) {
					return self._getAxisData(curr_data.yID).ypos;
				}) //rowid
				.attr("class", "pg_row_accent")
				.attr("width", this.state.modelWidth - 4)
				.attr("height", 12);

			this._resetLinks();

			/*
			 * To get the phenotype label from the selected rect data, we need to concat the phenotype ids to the model id
			 * that is in the 0th position in the grid. No labels exist with the curr_data.id except for the first column
			 * For the overview, there will be a 0th position for each species so we need to get the right model_id
			 */

			var phen_label = this.state.svg.selectAll("text#" + this._getConceptId(curr_data.yID));
			phen_label.style("font-weight", "bold");
			phen_label.style("fill", "blue");

			// Highlight Column
			var model_label = self.state.svg.selectAll("text#" + this._getConceptId(curr_data.xID));
			model_label.style("font-weight", "bold");
			model_label.style("fill", "blue");

			// create the related model rectangles
			var highlight_rect2 = self.state.svg.append("svg:rect")
				.attr("transform", "translate(" + (self.state.textWidth + self.state.xOffsetOver + 36) + "," + (self.state.yoffsetOver + 1) +  ")") // position control -Joe
				.attr("x", function(d) {
					return (self.state.xScale(curr_data.xID) - 1);
				})
				.attr("y", self.state.yoffset + 2 )
				.attr("class", "pg_col_accent")
				.attr("width", 12)
				.attr("height", (displayCount * self.state.heightOfSingleModel));
		},

		_updateAxes: function() {
			var self = this;
			var data = [];

			// This is for the new "Overview" target option
			if (this.state.targetSpeciesName == 'Overview') {
				data = this.state.modelDataHash.keys();
			} else {
				data = self.state.filteredModelData;
			}
			this.state.h = (data.length * 2.5);

			self.state.yScale = d3.scale.ordinal()
				.domain(data.map(function(d) {
					return d.yID;
				}))
				.range([0,data.length])
				.rangePoints([self.state.yModelRegion,self.state.yModelRegion + this.state.h]);

			// update accent boxes
			self.state.svg.selectAll("#rect.accent").attr("height", self.state.h);
		},

		/*
		 * Change the list of phenotypes and filter the models accordingly. The
		 * Movecount is an integer and can be either positive or negative
		 */
		_updateModel: function(newXPos, newYPos) {
			var xSize = this.state.xAxis.size();
			var ySize = this.state.yAxis.size();

			if (newXPos > xSize) {
				this.state.currXIdx = xSize;
			} else {
				this.state.currXIdx = newXPos;
			}

			if (newYPos > ySize) {
				this.state.currYIdx = ySize;
			} else {
				this.state.currYIdx = newYPos;
			}

			this._filterDisplay();
			this._clearXLabels();

			this._createXRegion();
			this._createYRegion();
			this._highlightSpecies();
			this._createModelRects();

			/*
			 * this must be initialized here after the _createModelLabels, or the mouse events don't get
			 * initialized properly and tooltips won't work with the mouseover defined in _convertLableHTML
			 */
			stickytooltip.init("*[data-tooltip]", "mystickytooltip");
		},

		// Previously _createModelLabels
		_createXLabels: function(self, models) {
			var model_x_axis = d3.svg.axis().scale(self.state.xScale).orient("top");
			self.state.svg.append("g")
				.attr("transform", "translate(" + (self.state.textWidth + self.state.xOffsetOver + 28) + "," + self.state.yoffset + ")")
				.attr("class", "x axis") // Classes applied to the g element - Joe
				.call(model_x_axis)
				// this be some voodoo...
				// to rotate the text, I need to select it as it was added by the axis
				.selectAll("text")
				.each(function(d, i) {
					var labelM = self._getAxisData(d).label;
					self._convertLabelHTML(self, this, self._getShortLabel(labelM, self.state.labelCharDisplayCount), d);
				});
		},

		// Previously _clearModelLabels
		_clearXLabels: function() {
			// In SVG, the g element is a container used to group objects. Transformations applied to the g element are performed on all of its child elements.
			// Attributes applied are inherited by child elements. - Joe
			this.state.svg.selectAll("g.x").remove(); // Fixed x labels overlaping - Joe
			this.state.svg.selectAll("g .tick.major").remove(); // Can be removed? - Joe
		},

		// Previously _createModelLines
		_createXLines: function() {
			// Make sure the X line is created once - Joe
			if (this.state.svg.select("#x_line")[0][0] === null) {
				var modelLineGap = 10;
				var lineX = this.state.yoffset - modelLineGap;

				this.state.svg.append("line")
					.attr("id", "x_line")
					.attr("transform", "translate(" + (this.state.textWidth + this.state.xOffsetOver + 30) + "," + lineX + ")")
					.attr("x1", 0)
					.attr("y1", 0)
					.attr("x2", this.state.modelWidth)
					.attr("y2", 0)
					.attr("stroke", "#0F473E")
					.attr("stroke-width", 1);
			}

			// Why the following? - Joe
			this.state.svg.selectAll("path.domain").remove();
			this.state.svg.selectAll("text.scores").remove();
			this.state.svg.selectAll("#pg_specieslist").remove();
		},

		_createYLines: function() {
			// Make sure the Y line is created once - Joe
			if (this.state.svg.select("#y_line")[0][0] === null) {
				var self = this;
				var modelLineGap = 30;
				var lineY = this.state.yoffset + modelLineGap;
				var displayCount = self._getYLimit();
				//this.state.svg.selectAll("path.domain").remove();
				//this.state.svg.selectAll("text.scores").remove();
				//this.state.svg.selectAll("#pg_specieslist").remove();

				var gridHeight = displayCount * self.state.heightOfSingleModel + 10;
				if (gridHeight < self.state.minHeight) {
					gridHeight = self.state.minHeight;
				}

				this.state.svg.append("line")
					.attr("id", "y_line")
					.attr("transform", "translate(" + (this.state.textWidth + 15) + "," + lineY + ")")
					.attr("x1", 0)
					.attr("y1", 0)
					.attr("x2", 0)
					.attr("y2", gridHeight)
					.attr("stroke", "#0F473E") // SVG stroke defines the color of a line, text, or outline of an element - Joe
					.attr("stroke-width", 1); // SVG stroke-width defines the thickness of a line, text, or outline of an element - Joe

			}

		},

		_createTextScores: function() {
			var self = this;
			var list = [];
			var xWidth = self.state.widthOfSingleModel;

			if ( ! this.state.invertAxis) {
				list = self._getSortedIDListStrict(this.state.filteredXAxis.entries());
			} else {
				list = self._getSortedIDListStrict(this.state.filteredYAxis.entries());
			}

			this.state.svg.selectAll("text.scores")
				.data(list)
				.enter()
				.append("text")
				.attr("height", 10)
				.attr("id", "pg_scorelist")
				.attr("width", xWidth)
				.attr("class", "scores")
				// don't show score if it is a dummy model.
				.text(function(d) {
					if (d === self.state.dummyModelName) {
						return "";
					} else {
						return self._getAxisData(d).score;
					}})
				//.style("font-weight", "bold") // normal font-weight for scores may be better? - Joe
				.style("fill", function(d) {
					return self._getColorForModelValue(self, self._getAxisData(d).score);
				});

				if (this.state.invertAxis) {
					this.state.svg.selectAll("text.scores").attr("y", function(d) {
						return self._getAxisData(d).ypos + 5;
					});
					this.state.svg.selectAll("text.scores").attr("x", 0);
					this.state.svg.selectAll("text.scores").attr("transform", "translate(" + (this.state.textWidth + 20) + "," + 40 + ")");
				} else {
					this.state.svg.selectAll("text.scores").attr("x", function(d, i) {
						return i * xWidth;
					});
					this.state.svg.selectAll("text.scores").attr("y", 0);
					this.state.svg.selectAll("text.scores").attr("transform", "translate(" + (this.state.textWidth + 54) + "," + this.state.yoffset + ")");
				}
		},

		// Add species labels to top of Overview
		_createOverviewSpeciesLabels: function() {
			var self = this;
			var speciesList = [];

			if ( ! this.state.invertAxis && self.state.targetSpeciesName == 'Overview') {
				speciesList = self.state.speciesList;
			} else {
				speciesList.push(self.state.targetSpeciesName);
			}
			var translation = "translate(" + (self.state.textWidth + self.state.xOffsetOver + 30) + "," + (self.state.yoffset + 10) + ")";

			var xPerModel = self.state.modelWidth/speciesList.length;
			var species = self.state.svg.selectAll("#pg_specieslist")
				.data(speciesList)
				.enter()
				.append("text")
				.attr("transform", translation)
				.attr("x", function(d,i) {
					return (i + 1 / 2 ) * xPerModel;
				})
				.attr("id", "pg_specieslist")
				.attr("y", 10)
				.attr("width", xPerModel)
				.attr("height", 10)
				.attr("fill", "#0F473E")
				.attr("stroke-width", 1)
				.text(function(d, i) {
					return speciesList[i];
				})
				.attr("text-anchor", "middle");
		},

		// we might want to modify this to do a dynamic http retrieval to grab the dialog components...
		_showDialog: function(name) {
			var self = this;
			var url = this._getResourceUrl(name, 'html');
			if (typeof(self.state.tooltips[name]) === 'undefined') {
				$.ajax({
					url: url,
					dataType: 'html',
					async: 'false',
					success: function(data) {
						self._populateDialog(self, name, data);
					},
					error: function (xhr, errorType, exception) {
					// Triggered if an error communicating with server
						self._populateDialog(self,"Error", "We are having problems with the server. Please try again soon. Error:" + xhr.status);
					}
				});
			}
			else {
				this._populateDialog(self, name, self.state.tooltips[name]);
			}
		},

		_populateDialog: function(self, name, text) {
			var SplitText = "Title";
			var $dialog = $('<div></div>')
				.html(SplitText )
				.dialog({
					modal: true,
					width:400,
					height: 260,
					draggable: true,
					dialogClass: "faqdialog_bg_color",
					position: {
						my: "top",
						at: "top+25%",
						of: "#pg_svg_area"
					},
					title: 'Phenogrid Notes',

					// Replace default jquery-ui titlebar close icon with font awesome - Joe
					open: function(event, ui) {
						// remove default close icon
						$('.ui-dialog-titlebar-close span').removeClass('ui-icon ui-icon-thickclose');
						// Yuck they have close text let's remove that
						$('.ui-dialog-titlebar-close span').text('');
						// Lets add font awesome close icon
						$('.ui-dialog-titlebar-close span').addClass('fa fa-times');
					}
				});
			$dialog.html(text);
			$dialog.dialog('open');
			self.state.tooltips[name] = text;
		},

		/*
		 * Build the three main left-right visual components: the rectangle containing the
		 * phenotypes, the main grid iself, and the right-hand side including the overview and color scales
		 */
		_createRectangularContainers: function() {
			var self = this;
			this._buildAxisPositionList();
			var displayCount = self._getYLimit();

			var gridHeight = displayCount * self.state.heightOfSingleModel + 10;
			if (gridHeight < self.state.minHeight) {
				gridHeight = self.state.minHeight;
			}

			var y = self.state.yModelRegion;
			// create accent boxes
			var rect_accents = this.state.svg.selectAll("#rect.accent")
				.data([0,1,2], function(d) {
					return d;
				});
			rect_accents.enter()
				.append("rect")
				.attr("class", "accent")
				.attr("x", function(d, i) {
				    return self.state.axis_pos_list[i];
				})
				.attr("y", y)
				.attr("width", self.state.textWidth + 5)
				.attr("height", gridHeight)
				.attr("id", function(d, i) {
					if (i === 0) {
						return "leftrect";
					} else if (i == 1) {
						return "centerrect";
					} else {
						return "rightrect";
					}
				})
				.attr("fill", function(d, i) {
					return i != 1 ? "#eee" : "#fff";
				});

			return gridHeight + self.state.yModelRegion;
		},

		// Build out the positions of the 3 boxes
		_buildAxisPositionList: function() {
			// For Overview of Organisms 0 width = ((multiOrganismCt*2)+2) *this.state.widthOfSingleModel
			// Add two extra columns as separators
			this.state.axis_pos_list = [];
			// calculate width of model section
			this.state.modelWidth = this.state.filteredXAxis.size() * this.state.widthOfSingleModel;
			// add an axis for each ordinal scale found in the data
			for (var i = 0; i < 3; i++) {
				// move the last accent over a bit for the scrollbar
				if (i == 2) {
					// make sure it's not too narrow i
					var w = this.state.modelWidth;
					if (w < this.state.smallestModelWidth) {
						w = this.state.smallestModelWidth;
					}
					this.state.axis_pos_list.push((this.state.textWidth + 50) + this.state.colStartingPos + w);
				} else if (i == 1) {
					this.state.axis_pos_list.push((i * (this.state.textWidth + this.state.xOffsetOver + 10)) + this.state.colStartingPos);
				} else {
					this.state.axis_pos_list.push((i * (this.state.textWidth + 10)) + this.state.colStartingPos);
				}
			}
		},

		// This code creates the labels for the x-axis, the lines, scores, etc..
		// Previously _createModelRegion
		_createXRegion: function() {
			var self = this;
			var mods = [];

			mods = self._getSortedIDListStrict(this.state.filteredXAxis.entries());

			this.state.xScale = d3.scale.ordinal()
				.domain(mods.map(function (d) {
					return d;
				}))
				.rangeRoundBands([0,this.state.modelWidth]);

			this._createXLabels(self, mods);
			this._createXLines();
			//[vaa12] These now darken when mini-map is moved
			if ( ! this.state.invertAxis) {
				this._createTextScores();
				this._createModelScoresLegend();
			}

			if (this.state.owlSimFunction != 'compare' && this.state.owlSimFunction != 'exomiser') {
				this._createOverviewSpeciesLabels();
			}
		},

		// this code creates the labels for the y-axis, the lines, scores, etc..
		_createYRegion: function () {
			this._createYLabels();

			this._createYLines();
			if (this.state.invertAxis) {
				this._createTextScores();
			}
		},

		_addPhenogridControls: function() {
			var phenogridControls = $('<div id="phenogrid_controls"></div>');
			this.element.append(phenogridControls);
			this._createSelectionControls(phenogridControls);
			
			// Unmatched phenotypes and the display
			this._buildUnmatchedPhenotypeDisplay();
		},

		_addGradients: function() {
			var self = this;
			var modData = this.state.modelDataHash.values();
			var temp_data = modData.map(function(d) {
				return d.value[self.state.selectedCalculation];
			});
			var diff = d3.max(temp_data) - d3.min(temp_data);
			var y1;

			// only show the scale if there is more than one value represented in the scale
			if (diff > 0) {
				// baseline for gradient positioning
				if (this.state.phenoLength < this.state.phenoDisplayCount) {
					y1 = 172;
				} else {
					y1 = 262;
				}
				this._createGradients(y1);
				this._buildGradientTexts(y1);
			}
		},

		/*
		 * Add the gradients to the grid
		 * y1 is the baseline for computing the y position of the gradient
		 */
		_createGradients: function(y1){
			var self = this;
			var x, y;

			var gradient = this.state.svg.append("svg:linearGradient") // The <linearGradient> element is used to define a linear gradient. - Joe
				.attr("id", "gradient")
				.attr("x1", "0")
				.attr("x2", "100%")
				.attr("y1", "0%")
				.attr("y2", "0%");

			for (var j in this.state.colorDomains) {
				if ( ! this.state.colorDomains.hasOwnProperty(j)) {
					break;
				}
				
				gradient.append("svg:stop") // SVG stop element
					.attr("offset", this.state.colorDomains[j]) // The offset attribute is used to define where the gradient color begin and end
					.style("stop-color", this.state.colorRanges[j]);
			}

			x = self.state.axis_pos_list[2] + 12;
			y = y1 + self.state.yoffset;
			
			var legend = this.state.svg.append("rect")
				.attr("transform", "translate(0,10)")
				.attr("class", "legend_rect")
				.attr("id","legendscale")
				.attr("x", x)
				.attr("y", y)
				.attr("width", 180)
				.attr("height", 12)
				.attr("fill", "url(#gradient)"); // The fill attribute links the element to the gradient defined in svg:linearGradient - Joe
		},

		/*
		 * Show the labels next to the gradients, including descriptions of min and max sides
		 * y1 is the baseline to work from
		 */
		_buildGradientTexts: function(y1) {
			var self = this;
			var lowText, highText, labelText;
			for (var idx in this.state.similarityCalculation) {
				if ( ! this.state.similarityCalculation.hasOwnProperty(idx)) {
					break;
				}
				if (this.state.similarityCalculation[idx].calc === this.state.selectedCalculation) {
					lowText = this.state.similarityCalculation[idx].low;
					highText = this.state.similarityCalculation[idx].high;
					labelText = this.state.similarityCalculation[idx].label;
					break;
				}
			}

			var ylowText = y1 + self.state.yoffset;
			var xlowText = self.state.axis_pos_list[2] + 10;
			var div_text1 = self.state.svg.append("svg:text")
				.attr("class", "pg_sim_text")
				.attr("x", xlowText)
				.attr("y", ylowText)
				.style("font-size", "10px")
				.text(lowText);

			var ylabelText = y1 + self.state.yoffset;
			var xlabelText = self.state.axis_pos_list[2] + 75;
			var div_text2 = self.state.svg.append("svg:text")
				.attr("class", "pg_sim_text")
				.attr("x", xlabelText)
				.attr("y", ylabelText)
				.style("font-size", "12px")
				.text(labelText);

			var yhighText = y1 + self.state.yoffset;
			var xhighText = self.state.axis_pos_list[2] + 125;
			var div_text3 = self.state.svg.append("svg:text")
				.attr("class", "pg_sim_text")
				.style("font-size", "10px")
				.text(highText);
				
			if (highText == 'Max' || highText == 'Highest') {
				div_text3.attr("x", xhighText + 25);
			} else {
				div_text3.attr("x", xhighText);
			}
			
			div_text3.attr("y", yhighText)
		},

		// build controls for selecting organism and comparison. Install handlers
		_createSelectionControls: function(container) {
			var self = this;
			var optionhtml ='<div id="selects" class="clearfix"></div>';
			var options = $(optionhtml);
			var orgSel = this._createOrganismSelection();
			options.append(orgSel);
			var sortSel = this._createSortPhenotypeSelection();
			options.append(sortSel);
			var calcSel = this._createCalculationSelection();
			options.append(calcSel);
			var axisSel = this._createAxisSelection();
			options.append(axisSel);

			container.append(options);
			// add the handler for the select control
			$("#pg_organism" ).change(function(d) {
				self.state.targetSpeciesName = self._getTargetSpeciesNameByIndex(self, d.target.selectedIndex);
				self._resetSelections("organism");
			});

			$("#pg_calculation" ).change(function(d) {
				self.state.selectedCalculation = self.state.similarityCalculation[d.target.selectedIndex].calc;
				self._resetSelections("calculation");
				self._processDisplay();
			});

			// add the handler for the select control
			$("#pg_sortphenotypes" ).change(function(d) {
				self.state.selectedSort = self.state.phenotypeSort[d.target.selectedIndex];
				self._resetSelections("sortphenotypes");
				self._processDisplay();
			});

			$("#pg_axisflip" ).click(function(d) {
				self.state.invertAxis = !self.state.invertAxis;
				self._resetSelections("axisflip");
			});

			self._configureFaqs();
		},

		// construct the HTML needed for selecting organism
		_createOrganismSelection: function() {
			var selectedItem;
			// In HTML tags, attributes need to use double quotes - Joe
			var optionhtml = "<div id='pg_org_div'><label class='pg_ctrl_label'>Species</label>" + // removed <br> - Joe
			"<span id='org_sel'><select id='pg_organism'>"; // select is inline level element, it's fine to use <span> - Joe

			for (var idx in this.state.targetSpeciesList) {
				if ( ! this.state.targetSpeciesList.hasOwnProperty(idx)) {
					break;
				}
				selectedItem = "";
				if (this.state.targetSpeciesList[idx].name === this.state.targetSpeciesName) {
					selectedItem = 'selected';
				}
				optionhtml += "<option value=\"" + this.state.targetSpeciesList[idx.name] +
				"\" " + selectedItem + ">" + this.state.targetSpeciesList[idx].name + "</option>";
			}
			// add one for overview.

			// Overview is not a proper name, change it later - Joe

			if (this.state.targetSpeciesName === 'Overview') {
				selectedItem = 'selected';
			} else {
				selectedItem = '';
			}
			optionhtml += "<option value=\"Overview\" " + selectedItem + ">Overview</option>";

			optionhtml += "</select></span></div>";
			return $(optionhtml);
		},

		// create the html necessary for selecting the calculation
		_createCalculationSelection: function () {

			var optionhtml = "<div id='pg_calc_div'><label class='pg_ctrl_label'>Display</label>"+ // changed span to div since the CSS name has "_div" - Joe
				"<span id='pg_calcs'> <i class='fa fa-info-circle cursor_pointer'></i></span>" + // <i class='fa fa-info-circle'></i> FontAwesome - Joe
				"<span id='calc_sel'><select id='pg_calculation'>";

			for (var idx in this.state.similarityCalculation) {
				if ( ! this.state.similarityCalculation.hasOwnProperty(idx)) {
					break;
				}
				var selecteditem = "";
				if (this.state.similarityCalculation[idx].calc === this.state.selectedCalculation) {
					selecteditem = "selected";
				}
				optionhtml += "<option value='" + this.state.similarityCalculation[idx].calc + "' " + selecteditem + ">" +
					this.state.similarityCalculation[idx].label + "</option>";
			}
			optionhtml += "</select></span></div>"; // changed span to div since the CSS name has "_div" - Joe
			return $(optionhtml);
		},

		// create the html necessary for selecting the sort
		_createSortPhenotypeSelection: function () {
			var optionhtml ="<div id='pg_sort_div'><label class='pg_ctrl_label'>Sort Phenotypes</label>" + // changed span to div since the CSS name has "_div" - Joe
				"<span id='pg_sorts'> <i class='fa fa-info-circle cursor_pointer'></i></span>" + // <i class='fa fa-info-circle'></i> FontAwesome - Joe
				"<span><select id='pg_sortphenotypes'>";

			for (var idx in this.state.phenotypeSort) {
				if ( ! this.state.phenotypeSort.hasOwnProperty(idx)) {
					break;
				}
				var selecteditem = "";
				if (this.state.phenotypeSort[idx] === this.state.selectedSort) {
					selecteditem = "selected";
				}
				optionhtml += "<option value='" + "' " + selecteditem + ">" + this.state.phenotypeSort[idx] + "</option>";
			}
			optionhtml += "</select></span></div>"; // Added missing </div> - Joe
			return $(optionhtml);
		},

		// create the html necessary for selecting the axis flip
		_createAxisSelection: function () {
			var optionhtml = "<div id='pg_axis_div'><label class='pg_ctrl_label'>Axis Flip</label>" +
			"<span id='org_sel'><button type='button' id='pg_axisflip'>Flip Axis</button></span></div>"; // <button> is an inline tag - Joe
			return $(optionhtml);
		},

		// this code creates the text and rectangles containing the text on either side of the y-axis data
		// Previously _createRowLabels
		_createYLabels: function() {
			var self = this;
			var pad = 14;
			var list = [];

			list = self._getSortedIDListStrict(self.state.filteredYAxis.entries());

			// Updating nodes - Joe
			var rect_text = this.state.svg.selectAll(".phenotype_label").data(list, function(d) {
					return d;
				});

			// Enter, create new nodes for incoming data - Joe
			rect_text.enter()
				.append("text")
				.attr("class", "phenotype_label")
			    // store the id for this item. This will be used on click events
				.attr("ontology_id", function(d) {
					return d;
				})
				.attr("id", function(d) {
					return d;
				})
				.attr("x", 208)
				.attr("y", function(d) {
					return self._getAxisData(d).ypos + 10;
				})
				.style("font-size", "12px")
				.style("text-anchor", "end")
				.on("mouseover", function(d) {
					self._selectYItem(d, d3.mouse(this));
				})
				.on("mouseout", function(d) {
					self._deselectData(d, d3.mouse(this));
				})
				.attr("data-tooltip", "sticky1")
				.style("fill", function(d) {
					return self._getExpandStyling(d);
				})
				.text(function(d) {
					var txt = self._getAxisData(d).label;
					if (txt === undefined) {
						txt = d;
					}
					txt = self._getShortLabel(txt);
					return self._decodeHtmlEntity(txt);
				});

			rect_text
				.attr("y", function(d) {
					return self._getAxisData(d).ypos + self.state.yoffsetOver + pad;
				});

			// Exit, remove outgoing nodes that are no longer needed - Joe
			rect_text.exit().remove();
		},

		_getUnmatchedPhenotypes: function() {
			var fullset = this.state.origPhenotypeData;
			var partialset = this.state.phenotypeListHash.keys();
			var full = [];
			var partial = [];
			var unmatchedset = [];
			var tempObject = {"id": 0, "observed": "positive"};

			for (var i in fullset) {
				if ( ! fullset.hasOwnProperty(i)) {
					break;
				}
				if (typeof(fullset[i].id) === 'undefined') {
					tempObject.id = fullset[i];
					full.push(tempObject);
				} else {
					full.push(fullset[i]);
				}
			}

			for (var j in partialset) {
				if ( ! partialset.hasOwnProperty(j)) {
					break;
				}
				partial.push(partialset[j].replace("_", ":"));
			}

			for (var k in full) {
				if ( ! full.hasOwnProperty(k)) {
					break;
				}
				// if no match in fullset
				if (partial.indexOf(full[k].id) < 0) {
					// if there unmatched set is empty, add this umatched phenotype
					unmatchedset.push(full[k]);
				}
			}

			var dupArray = [];
			dupArray.push(unmatchedset[0]);
			// check for dups
			for (var l in unmatchedset){
				if ( ! unmatchedset.hasOwnProperty(l)) {
					break;
				}
				var found = false;
				for (var m in dupArray) {
					if ( ! dupArray.hasOwnProperty(m)) {
						break;
					}
					if (dupArray[m].id == unmatchedset[l].id) {
						found = true;
					}
				}
				if (found === false) {
					dupArray.push(unmatchedset[l]);
				}
			}
			if (dupArray[0] === undefined) {
				dupArray = [];
			}

			return dupArray;
		},

		_buildUnmatchedPhenotypeDisplay: function() {
			var pg_ctrl = $("#phenogrid_controls");
			var pg_unmatched_phenotypes_html = '<div id="pg_unmatched_phenotypes_container" class="clearfix">';
			
			if (this.state.unmatchedPhenotypes !== undefined && this.state.unmatchedPhenotypes.length > 0) {
				pg_unmatched_phenotypes_html += "<div class='clearfix'><input type='checkbox' id='pg_unmatched_checkbox'>View Unmatched Phenotypes</div>"
												+ "<div id='pg_unmatched_phenotypes'>" + this._buildUnmatchedPhenotypes() + "</div>";
			} else {
				// No unmatched phenotypes
				pg_unmatched_phenotypes_html += "<div class='clearfix'>No Unmatched Phenotypes</div>";
			}

			pg_unmatched_phenotypes_html += '</div>'; // closing tag
			
			// Append to phenogrid controls
			pg_ctrl.append(pg_unmatched_phenotypes_html);
			
			// By default hide the unmatched phenotype list
			$("#pg_unmatched_phenotypes").hide();
			
			// Click and Toggle
			$("#pg_unmatched_checkbox").click(function() {
				var $this = $(this);

				if ($this.prop('checked')) {
					$("#pg_unmatched_phenotypes").show();
				} else {
					$("#pg_unmatched_phenotypes").hide();
				}
			});
		},

		_buildUnmatchedPhenotypes: function() {
			var self = this;
			var unmatched = self.state.unmatchedPhenotypes;

			var text = "";
			var label;

			// Notes:
			// - For phenotype page, the id format in URL, e.g., HP_0000746 will be redirected to HP:0000746
            // - For monarch-app json API, phenotype id format must be HP:0000746, don't use HP_0000746, 
			// because http://beta.monarchinitiative.org/phenotype/HP_0000746.json will be redirected 
			// to http://beta.monarchinitiative.org/phenotype/HP:0000746 (.json extension will be missing after redirection)
			for (var i in unmatched){
				if (unmatched[i].label !== undefined) {
					// Note: phenotype label is in the unmatched array when this widget runs in monarch-app
					// monarch-app's disease page and analyze/phenotype page returns the phenotype labels
					label = unmatched[i].label;
				} else {
					// Note: phenotype label is not in the unmatched array when this widget runs as a standalone app,
					// so we need to fetch each label from the monarch-app server
					// Sample output: http://beta.monarchinitiative.org/phenotype/HP:0000746.json
					$.ajax({
						url: this.state.serverURL + "/phenotype/" + unmatched[i].id + ".json",
						async: false,
						dataType: 'json',
						success: function(data) {
							// Show id if label is not found
							if (data.label !== undefined) {
								label = data.label;
							} else {
								label = data.id;
							}
						},
						error: function (xhr, errorType, exception) {
							console.log("We are having problems fetching the unmatched phenotypes from the server. Please try again later. Error:" + xhr.status);
						}
					});

				}

				// Use serverURL
				text += "<li><a href='" + this.state.serverURL + "/phenotype/" + unmatched[i].id + "' target='_blank'>" + label + "</a></li>";
			}
			
			// Wrap the content into a list
			return "<ul>" + text + "</ul>";
		},

		_matchedClick: function(checkboxEl) {
			if (checkboxEl.checked) {
				// Do something special
				$("#pg_unmatched").show();
			} else {
				// Do something else
				$("#pg_unmatched").hide();
			}
		},

		_toProperCase: function (oldstring) {
			return oldstring.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
		},

		/*
		 * given an array of phenotype objects edit the object array.
		 * items are either ontology ids as strings, in which case they are handled as is,
		 * or they are objects of the form { "id": <id>, "observed": <obs>}.
		 * in that case take id if "observed" is "positive"
		 */
		_filterPhenotypeResults: function(phenotypelist) {
			var newlist = [];
			var pheno;
			for (var i in phenotypelist) {
				if ( ! phenotypelist.hasOwnProperty(i)) {
					break;
				}
				pheno = phenotypelist[i];
				if (typeof pheno === 'string') {
					newlist.push(pheno);
				}
				if (pheno.observed === "positive") {
					newlist.push(pheno.id);
				}
			}
			return newlist;
		},

		// Will call the getHPO function to either load the HPO info or to make it visible if it was previously hidden.  Not available if preloading
		_expandHPO: function(id) {
			this._getHPO(id);

			// this code refreshes the stickytooltip so that tree appears instantly
			var hpoCached = this.state.hpoCacheHash.get(id.replace("_", ":"));

			if (hpoCached !== null) {
				this.state.hpoTreesDone = 0;
				this.state.hpoTreeHeight = 0;
				var info = this._getAxisData(id);
				var type = this._getIDType(id);
				var hrefLink = "<a href=\"" + this.state.serverURL+"/" + type +"/"+ id.replace("_", ":") + "\" target=\"_blank\">" + info.label + "</a>";
				var hpoData = "<strong>" + this._capitalizeString(type) + ": </strong> " + hrefLink + "<br/>";
				hpoData += "<strong>IC:</strong> " + info.IC.toFixed(2) + "<br/><br/>";

				var hpoTree = this.buildHPOTree(id.replace("_", ":"), hpoCached.edges, 0);


				if (hpoTree == "<br/>") {
					hpoData += "<em>No HPO Data Found</em>";
				} else {
					hpoData += "<strong>HPO Structure:</strong>" + hpoTree;
				}
				$("#sticky1").html(hpoData);

				// reshow the sticky with updated info
				stickytooltip.show(null);
			}
		},

		// Will hide the hpo info, not delete it.
		// This allows for reloading to be done faster and avoid unneeded server calls.  Not available if preloading
		_collapseHPO: function(id) {
			var idClean = id.replace("_", ":");
			var HPOInfo = this.state.hpoCacheHash.get(idClean);
			HPOInfo.active = 0;
			this.state.hpoCacheHash.put(idClean, HPOInfo);
			stickytooltip.closetooltip();
		},

		// When provided with an ID, it will first check hpoCacheHash if currently has the HPO data stored,
		// and if it does it will set it to be visible.  If it does not have that information in the hpoCacheHash,
		// it will make a server call to get the information and if successful will parse the information into hpoCacheHash and hpoCacheLabels
		_getHPO: function(id) {
			// check cached hashtable first
			var idClean = id.replace("_", ":");
			var HPOInfo = this.state.hpoCacheHash.get(idClean);

			var direction = this.state.hpoDirection;
			var relationship = "subClassOf";
			var depth = this.state.hpoDepth;
			var nodes, edges;
			// http://beta.monarchinitiative.org/neighborhood/HP_0003273/2/OUTGOING/subClassOf.json is the URL path - Joe
			if (HPOInfo === null) {
				HPOInfo = [];
				var url = this.state.serverURL + "/neighborhood/" + id + "/" + depth + "/" + direction + "/" + relationship + ".json";
				var taxon = this._getTargetSpeciesTaxonByName(this, this.state.targetSpeciesName);
				var results = this._ajaxLoadData(taxon, url);
				if (typeof (results) !== 'undefined') {
					edges = results.edges;
					nodes = results.nodes;
					// Labels/Nodes are done seperately to reduce redunancy as there might be multiple phenotypes with the same related nodes
					for (var i in nodes){
						if ( ! nodes.hasOwnProperty(i)) {
							break;
						}
						if ( ! this.state.hpoCacheLabels.containsKey(nodes[i].id) &&
							(nodes[i].id != "MP:0000001" &&
							nodes[i].id != "OBO:UPHENO_0001001" &&
							nodes[i].id != "OBO:UPHENO_0001002" &&
							nodes[i].id != "HP:0000118" &&
							nodes[i].id != "HP:0000001")) {
							this.state.hpoCacheLabels.put(nodes[i].id, this._capitalizeString(nodes[i].lbl));
						}
					}

					// Used to prevent breaking objects
					for (var j in edges) {
						if ( ! edges.hasOwnProperty(j)) {
							break;
						}
						if (edges[j].obj != "MP:0000001" &&
							edges[j].obj != "OBO:UPHENO_0001001" &&
							edges[j].obj != "OBO:UPHENO_0001002" &&
							edges[j].obj != "HP:0000118" &&
							edges[j].obj != "HP:0000001") {
							HPOInfo.push(edges[j]);
						}
					}
				}

				// HACK:if we return a null just create a zero-length array for now to add it to hashtable
				// this is for later so we don't have to lookup concept again
				if (HPOInfo === null) {
					HPOInfo = {};
				}

				// save the HPO in cache for later
				var hashData = {"edges": HPOInfo, "active": 1};
				this.state.hpoCacheHash.put(idClean, hashData);
			} else {
				// If it does exist, make sure its set to visible
				HPOInfo.active = 1;
				this.state.hpoCacheHash.put(idClean, HPOInfo);
			}
		},

		// expand the model with the associated genotypes
		_expandGenotypes: function(curModel) {
			$('#wait').show();
			var div=$('#mystickytooltip').html();
			$('#mystickytooltip').html(div);

			var genotypeIds = "", phenotypeIds = "", genoTypeAssociations;
			var genotypeLabelHashtable = new Hashtable();
			var success = false;
			var genoTypeList = new Hashtable();
			var modelInfo = {id: curModel, d: this.state.modelListHash.get(curModel)};
			var compareScores;

			// check cached hashtable first
			var cache = this.state.expandedHash.get(modelInfo.id);

			// if cached info not found need to try and get genotypes and scores
			if (cache === null) {

				// go get the assocated genotypes
				//var url = this.state.serverURL+"/gene/"+ modelInfo.id.replace('_', ':') + ".json";
				//var url = this.state.serverURL+"/genotypes/"+ modelInfo.id.replace('_', ':');
				// HARDCODE ALERT - REFACTOR
				var url = "http://beta.monarchinitiative.org/dynamic/gene/" + modelInfo.id.replace('_', ':') +
							"/genotype/nodes.json";
				console.log("Getting Gene " + url);
				//console.profile("genotypes call");
				var res = this._ajaxLoadData(modelInfo.d.species, url);

				res = this._filterGenotypeGraphList(res);
				//console.profileEnd();

				if (typeof (res) == 'undefined' || res.length === 0) {
					$('#wait').hide();
					stickytooltip.closetooltip();
					alert("No gene info found");
					return success;
				}

				//genoTypeAssociations = res.genotype_associations;
				genoTypeAssociations = res;

				if (genoTypeAssociations !== null && genoTypeAssociations.length > 5) {
					console.log("There are " + genoTypeAssociations.length + " associated genotypes");
				}

				var assocPhenotypes = this._getMatchingPhenotypes(modelInfo.id);
				var ctr = 0;

				// assemble the phenotype ids
				for (var p in assocPhenotypes) {
					if ( ! assocPhenotypes.hasOwnProperty(p)) {
						break;
					}
					phenotypeIds += assocPhenotypes[p].id + "+";
					ctr++;

					// limit number of genotypes do display based on internalOptions
					if (ctr > this.state.phenoCompareLimit && ctr < assocPhenotypes.length) {
						break;
					}
				}
				// truncate the last + off, if there
				if (phenotypeIds.slice(-1) == '+') {
					phenotypeIds = phenotypeIds.slice(0, -1);
				}

				ctr = 0;
				// assemble a list of genotypes
				for (var g in genoTypeAssociations) {
					if( ! genoTypeAssociations.hasOwnProperty(g)) {
						break;
					}
					//	_genotypeIds = _genotypeIds + genoTypeAssociations[g].genotype.id + "+";
					genotypeIds += genoTypeAssociations[g].id + "+";
					// fill a hashtable with the labels so we can quickly get back to them later
					//var tmpLabel = this._encodeHtmlEntity(genoTypeAssociations[g].genotype.label);
					//genotypeLabelHashtable.put(genoTypeAssociations[g].genotype.id, tmpLabel);
					var tmpLabel = this._encodeHtmlEntity(genoTypeAssociations[g].lbl);
					tmpLabel = (tmpLabel === null ? "undefined" : tmpLabel);
					genotypeLabelHashtable.put(genoTypeAssociations[g].id, tmpLabel);
					ctr++;

					// limit number of genotypes do display based on internalOptions
					if (ctr > this.state.genotypeExpandLimit && ctr < genoTypeAssociations.length) {
						break;
					}
				}

				// truncate the last + off, if there
				if (genotypeIds.slice(-1) == '+') {
					genotypeIds = genotypeIds.slice(0, -1);
				}

				// call compare
				url = this.state.serverURL + "/compare/" + phenotypeIds + "/" + genotypeIds;
				console.log("Comparing " + url);
				//console.profile("compare call");
				compareScores = this._ajaxLoadData(modelInfo.d.species, url);
				//console.profileEnd();
				console.log("Done with ajaxLoadData...");
			} else {
				compareScores = cache;
			}
			//cache == null

			if (typeof (compareScores)  !== 'undefined') {
				var iPosition = 1;
				// rebuild the model list with genotypes
				for (var idx in compareScores.b) {
					if ( ! compareScores.b.hasOwnProperty(idx)) {
						break;
					}
					var newGtLabel = genotypeLabelHashtable.get(compareScores.b[idx].id);
					var gt = {
					parent: modelInfo.id,
					label: (newGtLabel !== null?newGtLabel:compareScores.b[idx].label), // if label was null, then use previous fixed label
					// if label was null, then use previous fixed label
					score: compareScores.b[idx].score.score,
					species: modelInfo.d.species,
					rank: compareScores.b[idx].score.rank,
					type: "genotype",
					taxon: compareScores.b[idx].taxon.id,
					pos: (modelInfo.d.pos + iPosition),
					count: modelInfo.d.count,
					sum: modelInfo.d.sum
				};

					genoTypeList.put( this._getConceptId(compareScores.b[idx].id), gt);

					// Hack: need to fix the label because genotypes have IDs as labels
					compareScores.b[idx].label = genotypeLabelHashtable.get(compareScores.b[idx].id);

					// load these into model data
					this._loadDataForModel(compareScores.b[idx]);
					iPosition++;
				}

				// if the cache was originally null, then add
				// save the genotypes in hastable for later, store both the associated genotypes and raw data
				if (cache === null) {
					var savedScores = {b: compareScores.b, genoTypes: genoTypeList, expanded: true,
					totalAssocCount: genoTypeAssociations.length};
						this.state.expandedHash.put(modelInfo.id, savedScores);
				} else {
					// update the expanded flag
						var vals = this.state.expandedHash.get(modelInfo.id);
					vals.expanded = true;
					vals.genoTypes = genoTypeList;
						this.state.expandedHash.put(modelInfo.id, vals);
				}

				console.log("Starting Insertion...");
				this.state.modelListHash = this._insertionModelList(modelInfo.d.pos, genoTypeList);

				console.log("Rebuilding hashtables...");
				this._rebuildModelHash();

				this.state.modelLength = this.state.modelListHash.size();
				this._setAxisValues();

				console.log("updating display...");
				this._processDisplay(); //'updateModel');

				success = true;
			} else {
				alert('No compare scores found');
			}
			$('#wait').hide();
			stickytooltip.closetooltip();
			return success;
		},

		// collapse the expanded items for the current selected model
		_collapseGenotypes: function(curModel) {
			var modelInfo = {id: curModel, d: this.state.modelListHash.get(curModel)};

			// check cached hashtable first
			var cachedScores = this.state.expandedHash.get(modelInfo.id);

			// if found just return genotypes scores
			if (cachedScores !== null && cachedScores.expanded) {
				this.state.modelListHash = this._removalFromModelList(cachedScores);

				this._rebuildModelHash();
				this.state.modelLength = this.state.modelListHash.size();

				this._setAxisValues();
				this._processDisplay();

				// update the expanded flag
				var vals = this.state.expandedHash.get(modelInfo.id);
				vals.expanded = false;
				this.state.expandedHash.put(modelInfo.id, vals);
				stickytooltip.closetooltip();
			}
		},

		// get all matching phenotypes for a model
		_getMatchingPhenotypes: function(curModelId) {
			var self = this;
			var models = self.state.modelData;
			var phenoTypes = [];
			for (var i in models){
				if ( ! models.hasOwnProperty(i)) {
					break;
				}
				// models[i] is the matching model that contains all phenotypes
				if (models[i].model_id == curModelId) {
					phenoTypes.push({id: models[i].id_a, label: models[i].label_a});
				}
			}
			return phenoTypes;
		},

		// insert into the model list
		_insertionModelList: function (insertPoint, insertions) {
			var newModelList = new Hashtable();
			var sortedModelList= self._getSortedIDList(this.state.modelListHash.entries());
			var reorderPointOffset = insertions.size();
			var insertionOccurred = false;

			for (var i in sortedModelList) {
				if ( ! sortedModelList.hasOwnProperty(i)) {
					break;
				}
				var entry = this.state.modelListHash.get(sortedModelList[i]);
				if (entry.pos == insertPoint) {
					// add the entry, or gene in this case
					newModelList.put(sortedModelList[i], entry);
					var insertsKeys = insertions.keys();
					// begin insertions, they already have correct positions applied
					for(var j in insertsKeys) {
						var id = insertsKeys[j];
						newModelList.put(id, insertions.get(id));
					}
					insertionOccurred = true;
				} else if (insertionOccurred) {
					entry.pos = entry.pos + reorderPointOffset;
					newModelList.put(sortedModelList[i], entry);
				} else {
					newModelList.put(sortedModelList[i], entry);
				}
			}
			//var tmp = newModelList.entries();
			return newModelList;
		},

		// remove a models children from the model list
		_removalFromModelList: function (removalList) {
			var newModelList = new Hashtable();
			var newModelData = [];
			var removalKeys = removalList.genoTypes.keys();
			var sortedModelList= self._getSortedIDList(this.state.modelListHash.entries());
			var removeEntries = removalList.genoTypes.entries();

			// get the max position that was inserted
			var maxInsertedPosition = 0;
			for (var x in removeEntries){
				if ( ! removeEntries.hasOwnProperty(x)) {
					break;
				}
				var obj = removeEntries[x][1];
				if (obj.pos > maxInsertedPosition) {
					maxInsertedPosition = obj.pos;
				}
			}

			for (var i in sortedModelList){
				if ( ! sortedModelList.hasOwnProperty(i)) {
					break;
				}
				var entry = this.state.modelListHash.get(sortedModelList[i]);
				var found = false, cnt = 0;

				// check list to make sure it needs removed
				while (cnt < removalKeys.length && !found) {
					if (removalKeys[cnt] == sortedModelList[i]) {
						found = true;
					}
					cnt++;
				}
				if (found === false) {
					// need to reorder it back to original position
					if (entry.pos > maxInsertedPosition) {
						entry.pos =  entry.pos - removalKeys.length;
						//pos++;
						//entry.pos - maxInsertedPosition;
					}
					newModelList.put(sortedModelList[i], entry);
				}
			}

			// loop through to rebuild model data and remove any removals
			for (var y = 0; y < this.state.modelData.length; y++) {
				var id = this.state.modelData[y].model_id;
				var ret = removalKeys.indexOf(id);
				if (ret <  0) {
					newModelData.push(this.state.modelData[y]);
				}
			}

			this.state.modelData = newModelData;
			return newModelList;
		},

		_rebuildModelHash: function() {
			// [vaa12] needs updating based on changes in finishLoad and finishOverviewLoad
			this.state.phenotypeListHash = new Hashtable();

			// Create a new empty hash table with supplied options, Hashtable(Object options) - Joe
			this.state.modelDataHash = new Hashtable({hashCode: model.modelDataPointPrint, equals: model.modelDataPointEquals});
			var modelPoint, hashData;
			var y = 0;

			// need to rebuild the pheno hash and the modelData hash
			for (var i in this.state.modelData) {
				if ( ! this.state.modelData.hasOwnProperty(i)) {
					break;
				}
				// Setting phenotypeListHash
				if (typeof(this.state.modelData[i].id_a) !== 'undefined' && !this.state.phenotypeListHash.containsKey(this.state.modelData[i].id_a)) {
					hashData = {"label": this.state.modelData[i].label_a, "IC": this.state.modelData[i].IC_a, "pos": y, "count": 0, "sum": 0, "type": "phenotype"};
					this.state.phenotypeListHash.put(this.state.modelData[i].id_a, hashData);
					y++;
				}

				// Setting modelDataHash
				if (this.state.invertAxis) {
					modelPoint = new model.modelDataPoint(this.state.modelData[i].id_a, this.state.modelData[i].model_id);
				} else {
					modelPoint = new model.modelDataPoint(this.state.modelData[i].model_id, this.state.modelData[i].id_a);
				}
				this._updateSortVals(this.state.modelData[i].id_a, this.state.modelData[i].subsumer_IC);
				hashData = {"value": this.state.modelData[i].value, "subsumer_label": this.state.modelData[i].subsumer_label, "subsumer_id": this.state.modelData[i].subsumer_id, "subsumer_IC": this.state.modelData[i].subsumer_IC, "b_label": this.state.modelData[i].label_b, "b_id": this.state.modelData[i].id_b, "b_IC": this.state.modelData[i].IC_b};
				this.state.modelDataHash.put(modelPoint, hashData);
			}
		},


		// According to harry, not showing in current master version - Joe
		_getAssociatedGenotypes: function(curModel) {
			// check cached hashtable first
			var gta = this.state.expandedHash.get(curModel.model_id);

			// if null then go find genotypes
			if (gta === null) {
				var url = this.state.serverURL+"/gene/"+ curModel.model_id + ".json";
				//var url = "http://stage-monarch.monarchinitiative.org/gene/"+ gene + ".json";

				var res = this._ajaxLoadData(curModel.species, url);
				if (typeof (res)  !== 'undefined') {
					gta = res.genotype_associations;
				}

				// HACK:if we return a null just create a zero-length array for now to add it to hashtable
				// this is for later so we don't have to lookup concept again
				if (gta === null) {
					gta = {};
				}

				// save the genotypes in hastable for later
				this.state.expandedHash.put(curModel.model_id, gta);
			}
			return gta;
		},

		// encode any special chars
		_encodeHtmlEntity: function(str) {
			if (str !== null) {
				return str
				.replace(/»/g, "&#187;")
				.replace(/&/g, "&amp;")
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;")
				.replace(/"/g, "&quot;")
				.replace(/'/g, "&#039;");
			}
			return str;
		},

		_decodeHtmlEntity: function(str) {
			return $('<div></div>').html(str).text();
		},

		// get the css styling for expanded gene/genotype
		_getExpandStyling: function(data) {
			var concept = this._getConceptId(data);

			if (typeof(concept) === 'undefined' ) {
				return "#000000";
			}
			var info = this._getIDTypeDetail(concept);

			if (info == 'gene') {
				var g = this.state.expandedHash.get(concept);
				if (g !== null && g.expanded) {
					return "#08594B";
				}
			}
			else if (info == 'genotype') {
				return "#488B80"; //"#0F473E";
			}
			return "#000000";
		},

		// check to see object is expanded
		_isExpanded: function(data) {
			var concept = this._getConceptId(data);
			var info = this._getIDTypeDetail(concept);

			if (info == 'gene') {
				var g = this.state.expandedHash.get(concept);
				// if it was ever expanded
				if (g !== null){
					return g.expanded;
				}
			}
			return null;
		},

		// check to see object has children
		_hasChildrenForExpansion: function(data) {
			var concept = this._getConceptId(data);
			var info = this._getIDTypeDetail(concept);

			if (info == 'gene') {
				var g = this.state.expandedHash.get(concept);
				// if it was ever expanded it will have children
				if (g !== null) {
					return true;
				}
			}
			return false;
		},

		_isGenoType: function(data) {
			var concept = this._getConceptId(data);
			var info = this._getIDTypeDetail(concept);

			if (info == 'genotype') {
				return true;
			}
			return false;
		},

		_filterGenotypeGraphList: function(res) {

			if (typeof(res) === 'undefined') return res;

			var nodes = res.nodes;
			var filteredList = [];

			for (var n in nodes) {
				if(!nodes.hasOwnProperty(n)){break;}
				if (nodes[n].id.substring(0, 5) != 'genid' ) {
					filteredList.push(nodes[n]);
				}
			}
			return filteredList;
		},

		_refreshSticky: function() {
			var div=$('#mystickytooltip').html();
			$('#mystickytooltip').html(div);
		}

	}); // end of widget code
});


}());
