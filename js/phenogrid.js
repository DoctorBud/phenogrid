/*
 *
 * Phenogrid - the Phenogrid widget.
 * 
 * implemented as a jQuery UI (jqueryui.com) widget, this can be instantiated on a jquery-enabled web page
 *  with a call of the form 
 *  $("#mydiv).phenogrid({phenotypeData: phenotypeList}).
 * 
 *  where 
 *
 *   #mydiv is the id of the div that will contain the phenogrid widget
 *   
 *   and phenotypeList takes one of two forms:
 *
 *   1. a list of hashes of the form 
 * [ {"id": "HP:12345", "observed" :"positive"}, {"id: "HP:23451", "observed" : "negative"},]
 *   2. a simple list of ids..
 *  [ "HP:12345", "HP:23451"], etc.
 *
 * Configuration options useful for setting species displayed, similarity calculations, and 
 * related parameters can also be passed in this hash. As of September
 * 2014, these options are currently being refactored - further
 * documentation hopefully coming soon.
 *
 *
 *  The phenogrid widget uses semantic similarity calculations
 *  provided by OWLSim (www.owlsim.org), as provided through APIs from
 *  the Monarch initiative (www.monarchinitiative.org). 
 * 
 *  Given an input list of phenotypes and parameters indicating
 *  desired source of matching models (humans, model organisms, etc.),
 *  the phenogrid will call the Monarch API to get OWLSim results
 *  consisting of arrays of the items of the following form:
 *  {
 *     "id":"HP_0000716_MP_0001413_MGI_006446",
 *     "label_a":"Depression",
 *     "id_a":"HP:0000716",
 *     "subsumer_label":"Abnormal emotion/affect behavior",
 *     "subsumer_id":"HP:0100851",
 *     "value":5.667960271407814,
 *     "label_b":"abnormal response to new environment",
 *     "id_b":"MP:0001413",
 *     "model_id":"MGI_006446",
 *     "model_label":"B10.Cg-H2<sup>h4</sup>Sh3pxd2b<sup>nee</sup>/GrsrJ",
 *     "rowid":"HP_0000716_HP_0100851"
 *  },
 *
 * These results will then be rendered in the phenogrid
 *
 *
 *
 *
 * NOTE: I probably need a model_url to render additional model info on 
 * the screen.  Alternatively I can load the data 
 * as a separate call in the init function.
 *
 * META NOTE (HSH - 8/25/2014): Can we remove this note, or at least clarify?
 */
var url = document.URL;

(function($) {
    
    $.widget("ui.phenogrid", {

	// core commit. Not changeable by options. 
	config: {
	    scriptpath : $('script[src]').last().attr('src').split('?')[0].split('/').slice(0, -1).join('/')+'/',        
   	    colorDomains: [0, 0.2, 0.4, 0.6, 0.8, 1],
	    colorRanges: [['rgb(229,229,229)','rgb(164,214,212)','rgb(68,162,147)','rgb(97,142,153)','rgb(66,139,202)','rgb(25,59,143)'],
			  ['rgb(252,248,227)','rgb(249,205,184)','rgb(234,118,59)','rgb(221,56,53)','rgb(181,92,85)','rgb(70,19,19)'],
			  ['rgb(230,209,178)','rgb(210,173,116)','rgb(148,114,60)','rgb(68,162,147)','rgb(31,128,113)','rgb(3,82,70)'],
			  ['rgb(229,229,229)','rgb(164,214,212)','rgb(68,162,147)','rgb(97,142,153)','rgb(66,139,202)','rgb(25,59,143)']], 
	    overviewCount: 3,
	    colStartingPos: 10,
	    detailRectWidth: 300,   
            detailRectHeight: 140,
            detailRectStrokeWidth: 3,
	    globalViewSize : 110,
	    reducedGlobalViewSize: 30,
	    h : 526,
	    m :[ 30, 10, 10, 10 ],
	    multiOrganismCt: 10,
	    multiOrgModelLimit: 750,
	    phenotypeSort: [{type: "Alphabetic", order: 0},{type: "Frequency and Rarity", order:1} ,{type: "Frequency", order:2} ],	    
	    similarityCalculation: [{label: "Similarity", calc: 0}, {label: "Ratio (q)", calc: 1}, {label: "Ratio (t)", calc: 3} , {label: "Uniqueness", calc: 2}],
	    smallestModelWidth: 400,
	    textLength: 34,
	    textWidth: 200,
	    w : 0,
	    headerAreaHeight: 160,
	    comparisonTypes: [ { organism: "Homo sapiens",
				 comparison: "diseases"}],
	    defaultComparisonType: { comparison: "genes"},
	    speciesLabels : [ { abbrev: "HP", label: "Human"},
			      { abbrev: "MP", label: "Mouse"},
			      { abbrev: "ZFIN", label: "Zebrafish"},
			      { abbrev: "ZP", label: "Zebrafish"},
			      { abbrev: "FB", label:  "Fly"},
			      { abbrev: "GO", label: "Gene Ontology"}],
	    modelDisplayCount : 30,
	    phenotypeDisplayCount : 26,
	    defaultPhenotypeDisplayCount: 26,
	    apiEntityMap: [ {prefix: "HP", apifragment: "disease"},
			    {prefix: "OMIM", apifragment: "disease"}],
	    defaultApiEntity: "gene",
	    tooltips: {},
	    widthOfSingleModel: 18,
	    overviewGap: 30,
	    nonOverviewGap: 5,
	    overviewGridTitleXOffset: 340,
	    overviewGridTitleFaqOffset: 230,
	    nonOverviewGridTitleXOffset: 220,
	    nonOverviewGridTitleFaqOffset: 570,
	    gridTitleYOffset: 20,
	    baseYOffset: 150
	    
	},


	internalOptions:   {
	    /// good - legit options

	    serverURL: "",
	    selectedCalculation: 0,
	    selectedSort: "Frequency",
	    targetSpeciesName : "Overview",	    	
	    refSpecies: "Homo sapiens",
	    targetSpeciesList : [{ name: "Homo sapiens", taxon: "9606"},
				 { name: "Mus musculus", taxon: "10090" },
				 { name: "Danio rerio", taxon: "7955"},
				 { name: "Drosophila melanogaster", taxon: "7227"},
				],
	    
	},
	
	//reset state values that must be cleared before reloading data
	_reset: function() {

	    this.state.modelData = [];
	    this.state.modelList = [];
	    this.state.filteredModelData = [];
	    this.state.filteredModelList = [];

	    this.state.yAxisMax = 0;
	    this.state.yoffset  = this.state.baseYOffset;
	    //basic gap for a bit of space above modelregion
	    this.state.yoffsetOver = this.state.nonOverviewGap;
	    this.state.modelName = "";

	    //  this.state.yTranslation = 0;

	    // must reset height explicitly
	    this.state.h = this.config.h;

	    this.data = {};
	},
	
	//this function will use the desired height to determine how many phenotype rows to display
	//the basic formula is: (height - headerAreaHeight)/14.
	//return -1 if the available space is too small to properly display the grid   
	_calcPhenotypeDisplayCount: function() {
	    var self = this;

	    var pCount = Math.round((self.state.h - self.state.headerAreaHeight) / 14);
	    if (pCount < 10) {
		pCount = -1;
	    }
	    return pCount;
	},

	
	/** Several procedures for various aspects of filtering/identifying appropriate entries
	    in the target species list.. */
	_getTargetSpeciesIndexByName: function(self,name) {
	    var index = -1;
	    if (typeof(self.state.targetSpeciesByName[name]) !== 'undefined') {
		index  = self.state.targetSpeciesByName[name].index;
	    }
	    return index;
	},

	_getTargetSpeciesNameByIndex: function(self,index) {
	    var species
	    if  (typeof(self.state.targetSpeciesList[index]) !== 'undefined') {
		species = self.state.targetSpeciesList[index].name;
	    }
	    else {
		species = 'Overview';
	    }
	    return species;
	},

	_getTargetSpeciesTaxonByName: function(self,name) {
	    var taxon;
	    if (typeof(self.state.targetSpeciesByName[name]) !== 'undefined') {
		taxon  = self.state.targetSpeciesByName[name].taxon;
	    }
	    return taxon;
	},
	
	//NOTE: I'm not too sure what the default init() method signature should be
	//given an imageDiv and phenotype_data list
	/**
	 * imageDiv - the place you want the widget to appear
	 * phenotype_data - a list of phenotypes in the following format:
	 * [ {"id": "HP:12345", "observed" :"positive"}, {"id: "HP:23451", "observed" : "negative"},]
	 * or simply a list of IDs.
	 * [ "HP:12345", "HP:23451", ...]
	 */
	_create: function() {


	    // must be available from js loaded in a separate file...
	    this.configoptions = configoptions;
	    /** check these */
	    // important that config options (from the file) and this. options (from
	    // the initializer) come last
	    this.state = $.extend({},this.internalOptions,this.config,
				  this.configoptions,this.options);
	    this.state.data = {}
	    // will this work?
	    this.configoptions = undefined;
	    this._createTargetSpeciesIndices();
	    // index species
	    this._reset();
	},


	// create a shortcut index for quick access to target species by name - to get index (position) and
	// taxon
	_createTargetSpeciesIndices: function() {
	    this.state.targetSpeciesByName={};
	    for (var j = 0; j < this.state.targetSpeciesList.length; j++ ) {
		// list starts as name, taxon pairs
		var name = this.state.targetSpeciesList[j].name;
		var taxon = this.state.targetSpeciesList[j].taxon;
		var entry = {};
		entry.index = j;
		entry.taxon = taxon;
		this.state.targetSpeciesByName[name]= entry;
	    }
	},


	// HACK WARNING - 20140926, harryh@pitt.edu
	// phenogrid assumes a path of /js/res relative to the scriptpath directory. This will contain configuration files
	// that will be loaded via urls constructed in this function.
	// As of 9/26/2014, the puptent application used in monarch-app breaks this.
	// thus, a workaround is included below to set the path correctly if it come up as '/'.
	// this should not impact any standalone uses of phenogrid, and will be removed once monarch-app is cleaned up.
	_getResourceUrl: function(name,type) {
	    var prefix;
	    if (typeof(this.config.scriptpath) !== 'undefined' && this.config.scriptpath !== null && this.config.scrippath != ''
	        && this.config.scriptpath !='/') {
		prefix = this.config.scriptpath;
	    }
	    else {
		prefix ='/widgets/phenogrid/js/';
	    }
	    var res = prefix+'res/'+name+'.'+type;
	    return prefix+'res/'+name+'.'+type;
	},

	
	_init: function() {
	    //  console.time("init");
	    this.element.empty();
	    this._loadSpinner();
	    this.state.phenotypeDisplayCount = this._calcPhenotypeDisplayCount();
	    //save a copy of the original phenotype data
	    this.state.origPhenotypeData = this.state.phenotypeData.slice();

	    this._setSelectedCalculation(this.state.selectedCalculation);
	    this._setSelectedSort(this.state.selectedSort);
	    //   this.state.yTranslation = 0;
	    this.state.w = this.state.m[1]-this.state.m[3];

	    this.state.currModelIdx = this.state.modelDisplayCount-1;
	    this.state.currPhenotypeIdx = this.state.phenotypeDisplayCount-1;
	    this.state.phenotypeLabels = this._filterPhenotypeLabels(this.state.phenotypeData);
	    this.state.phenotypeData = this._filterPhenotypeResults(this.state.phenotypeData);
	    console.time("load");
	    this._loadData();
	    //	    console.timeEnd("load");

	    // amont of extra space needed for overview
	    if (this.state.targetSpeciesName == "Overview") {
	    	this.state.yoffsetOver = this.state.overviewGap;
	    }
	    // shorthand for top of model region
	    this.state.yModelRegion = this.state.yoffsetOver+this.state.yoffset;

	    this._filterData(this.state.modelData);
	    this.state.unmatchedPhenotypes = this._getUnmatchedPhenotypes();
	    this.element.empty();
	    console.time("reDraw");
	    this.reDraw();
	    //  console.timeEnd("reDraw");
	    // console.timeEnd("init");
	},

	_loadSpinner: function() {

	    var element =$('<div id="spinner"><h3>Loading...</h3><div class="cube1"></div><div class="cube2"></div></div>');
	    this._createSvgContainer()
	    element.appendTo(this.state.svgContainer);
	},

	reDraw: function() {
	    if (this.state.modelData.length != 0 && this.state.phenotypeData.length != 0
		&& this.state.filteredPhenotypeData.length != 0){

		this._setComparisonType();
		//			 console.time("initCanvas");
		this._initCanvas();
		// console.timeEnd("initCanvas");
		this._addLogoImage();
		
		this.state.svg
		    .attr("width", "100%")
		    .attr("height", this.state.phenotypeDisplayCount * 18);
		console.time("accents-color");
		this._createRectangularContainers();				
		this._createColorScale();
		//			 console.timeEnd("accents-color");
		
		//			 console.time("model-region");
		var ymax  = this._createModelRegion();
		console.log("ymax is "+ymax);
		//			 console.timeEnd("model-region");
		
		//			 console.time("axes");		 
		this._updateAxes();
		//			 console.timeEnd("axes");
		
		//			 console.time("gridlines");
		this._createGridlines();
		//			 console.timeEnd("gridlines");
		//			 console.time("modelrects");
		this._createModelRects();
		//			 console.timeEnd("modelrects");
		//			 console.time("createRowLabels");
		this._createRowLabels();
		//			 console.timeEnd("createRowLabels");
		//			 console.time("overview");
		this._createOverviewSection();
		//			 console.timeEnd("overview");
		
	    	ymax = ymax + 60; //gap MAGIC NUBER ALERT. DOES THIS
		//NEED TO BE CLEANED?
		console.log("phenotype display count is "+ this.state.phenotypeDisplayCount);
		var height = this.state.phenotypeDisplayCount*18+this.state.yoffsetOver;
		
		if (height < ymax) {
		    height = ymax+60;
		}
		var containerHeight = height + 10; // MAGIC NUMBER? OR OVERVIEWW OFFSET?
		console.log("svg area  height is "+ height);
		console.log("svg container height is "+ containerHeight);
		$("#svg_area").css("height",height);
		$("#svg_container").css("height",containerHeight);
	    }
	    else {
		var msg = "There are no " + self.state.targetSpeciesName + " models for this disease." 
		console.log("no data....");
		this._createSvgContainer();
		this._createEmptyVisualization(msg);
	    }
	},
	
	_resetIndicies: function() {
	    this.state.currModelIdx = this.state.modelDisplayCount-1;
	    this.state.currPhenotypeIdx = this.state.phenotypeDisplayCount-1;	
	},
	
	/* dummy option procedures as per 
	   http://learn.jquery.com/jquery-ui/widget-factory/how-to-use-the-widget-factory/
	   likely to have some content added as we proceed
	*/
	_setOption: function( key, value ) {
            this._super( key, value );
	},

	_setOptions: function( options ) {
            this._super( options );
	},

	
	//create this visualization if no phenotypes or models are returned
	_createEmptyVisualization: function(msg) {

	    d3.select("#svg_area").remove();
	    this.state.svgContainer.append("<svg id='svg_area'></svg>");
            this.state.svg = d3.select("#svg_area");
            
            var svgContainer = this.state.svgContainer;
	    svgContainer.append("<svg id='svg_area'></svg>");		
	    this.state.svg = d3.select("#svg_area")
		.attr("width", 1100)
		.attr("height", 70);	 
            
	    
	    
	    //var error = "<br /><div id='err'><h4>" + msg + "</h4></div><br /><div id='return'><button id='button' type='button'>Return</button></div>";
	    //this.element.append(error);
	    
	    var html = "<h4 id='err'>" + msg + "</h4><br /><div id='return'><button id='button' type='button'>Return</button></div>";	    
            this.element.append(html);
	    
	    var btn = d3.selectAll("#button")
		.on("click", function(d,i){
		    $("#return").remove();
		    $("#errmsg").remove();
		    d3.select("#svg_area").remove();

		    self.state.phenotypeData = self.state.origPhenotypeData.slice();
		    self._reset();
		    self.state.targetSpeciesName ="Overview";
		    self._init();
		});
	},
	
	//adds light gray gridlines to make it easier to see which row/column selected matches occur
	_createGridlines: function() { 
	    var self=this;
	    
	    //create a blank grid to match the size of the phenogrid grid				
	    var data = new Array(),
		modelCt = 0;
	    
	    //This is for the new "Overview" target option 		
	    //if (this.state.targetSpeciesName == "Overview"){ modelCt = self.state.multiOrganismCt * 3;}
	    //else { modelCt = self.state.modelDisplayCount;}
	    modelCt = self.state.modelDisplayCount;
	    for (var k = 0; k < self.state.phenotypeDisplayCount; k++){
		for (var l = 0; l < modelCt; l++) {
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
		.attr("id","gridline")
		.attr("transform","translate(232, " + (this.state.yModelRegion + 5) +")")
		.attr("x", function(d,i) { return d[1] * 18 })
		.attr("y", function(d,i) { return d[0] * 13 })  
		.attr("class", "hour bordered deselected")
		.attr("width", 14)
		.attr("height", 11.5);				      
	}, 
	
	//for the selection area, see if you can convert the selection to the idx of the x and y
	//then redraw the bigger grid 
	_createOverviewSection: function() {
	    var self=this;
	    
	    // add-ons for stroke size on view box
	    var strokePadding = 6;

	    // overview region is offset by xTranslation, yTranslation
	    var xTranslation = 42;
	    var yTranslation = 30;

	    // these translations from the top-left of the rectangular region give the
	    // absolute coordinates
	    var overviewX = self.state.axis_pos_list[2]+xTranslation;
	    var overviewY = self.state.yModelRegion+yTranslation;
	    console.log("top left corner of overview box is "+overviewX+", "+overviewY);

	    // size of the entire region - it is a square
	    var overviewRegionSize = self.state.globalViewSize;
	    if (this.state.phenotypeData.length < this.state.defaultPhenotypeDisplayCount) {
		overviewRegionSize = self.state.reducedGlobalViewSize;
	    }

	    // create the legend for the modelScores
	    self._createModelScoresLegend();

	    // make it a bit bigger to ccont for widths
	    // MAGIC NUMBER ALERT
	    var overviewBoxDim = overviewRegionSize+strokePadding;

	    // create the main box and the instruction labels.
	    self._initializeOverviewRegion(overviewBoxDim,overviewX,overviewY);


	    // create the scales
	    self._createSmallScales(overviewRegionSize);
	    
	    //add the items using smaller rects
	    var mods = self.state.modelList;
	    var modData = self.state.modelData;

	    var model_rects = this.state.svg.selectAll(".mini_models")
	      	.data(modData, function(d) {
	      	    return d.id;
	      	});


	    var modelRectTransform = "translate(" + overviewX +	"," + overviewY + ")"
	    model_rects.enter()
		.append("rect")
		.attr("transform",modelRectTransform)
		.attr("class",  "mini_model")
		.attr("y", function(d, i) { return self.state.smallYScale(d.id_a);})
		.attr("x", function(d) { return self.state.smallXScale(d.model_id);})
		.attr("width", 2)
		.attr("height", 2)
		.attr("fill", function(d,i) { return self._setRectFill(self,d,i)});
	    
	    var lastId = self.state.phenotypeSortData[self.state.phenotypeDisplayCount-1][0].id_a; //rowid
	    var selectRectHeight = self.state.smallYScale(lastId);
	    var selectRectWidth = self.state.smallXScale(mods[self.state.modelDisplayCount-1].model_id);

	    console.log("overview Box Dim is "+overviewBoxDim);
	    console.log("select rect width is "+selectRectWidth);
	    console.log("select rect height is "+selectRectHeight);

	    
	    
	    console.log("setting up select rect..."+overviewY);
	    self.state.highlightRect = self.state.svg.append("rect")
	        .attr("x",overviewX)
	        .attr("y",overviewY)
		.attr("class", "draggable")					
		.attr("id", "selectionrect")
		.attr("height", selectRectHeight)
		.attr("width", selectRectWidth)
		.call(d3.behavior.drag()
		      /*.origin(function() {
			  var current = d3.select(this);
			  var res ={x: current.attr("x"), y: current.attr("y") };
			  console.log("origin.... "+JSON.stringify(res));
			  return  res;
		      })*/ 
		      .on("drag", function(d) {
            		  // drag the highlight in the overview window
            		  //notes: account for the width of the rectangle in my x and y calculations
            		  //do not use the event x and y, they will be out of range at times.  use the converted values instead.

			  console.log("drag delta is ..."+d3.event.dx+","+d3.event.dy);
			  var current = d3.select(this);
			  var curX = parseFloat(current.attr("x"));
			  var curY = parseFloat(current.attr("y"));
	//		  console.log("current location is..."+curX+","+curY);
			 
            		  var rect = self.state.svg.select("#selectionrect");
			  rect.attr("transform","translate(0,0)");

        		  //limit the range of the x value

 			  var newX = curX+d3.event.dx;
			  var newY = curY+d3.event.dy;

			  // block from going out of bounds on left
			  if (newX  <overviewX) {
			      newX =overviewX;
			  }
			  //top
			  if (newY < overviewY) {
			      newY = overviewY;
			  }
			  // right
			  if (newX +  selectRectWidth > overviewX+overviewBoxDim) {
			      newX = overviewX+overviewBoxDim-selectRectWidth;
			  }

			  // bottom
			  if (newY + selectRectHeight > overviewY+overviewBoxDim) {
			      newY = overviewY+overviewBoxDim-selectRectHeight;
			  }
			      
			 // console.log("dragging overview at..."+newX+", "+newY);
			  rect.attr("x", newX);
       			  //This changes for vertical positioning
       			  rect.attr("y", newY); //self.state.yoffset+yTranslation); 
			  
			  // adjust x back to have 0,0 as base instead of overviewX, overviewY
			  newX = newX- overviewX;
			  newY = newY -overviewY;

			  // invert newX and newY into posiions in the model and phenotype lists.
			  var j = self._invertOverviewDragPosition(self.state.smallXScale,newX);
               		  var newModelPos = j+self.state.modelDisplayCount;

        		  var j = self._invertOverviewDragPosition(self.state.smallYScale,newY);
               		  var newPhenotypePos = j+self.state.phenotypeDisplayCount;
			  
               		  self._updateModel(newModelPos, newPhenotypePos);
		      }));
	    //set this back to 0 so it doesn't affect other rendering
	},

	/* we only have 3 color,s but that will do for now */
	_setRectFill: function(self,d,i) {
	    //This is for the new "Overview" target option
	    var selectedScale;
	    var scaleIndex  = this._getTargetSpeciesIndexByName(self,d.species);
	    var selectedScale = self.state.colorScale[scaleIndex];
	    return selectedScale(d.value);
	},

	_createModelScoresLegend: function() {
	    var faqOffset = 20;
	    var scoreTipY = self.state.yoffset;
	    var faqY = scoreTipY-faqOffset
	    var tipTextLength =92;
	    var scoretip = self.state.svg.append("text")
		.attr("transform","translate(" + (self.state.axis_pos_list[2] ) + "," + scoreTipY+ ")")
    	        .attr("x", 0)
		.attr("y", 0)
		.attr("class", "tip")
		.text("< Model Scores");			
	    
	    var tip	= self.state.svg
		.append("svg:image")				
		.attr("xlink:href", this.state.scriptpath + "../image/greeninfo30.png")
		.attr("transform","translate(" + (self.state.axis_pos_list[2] +tipTextLength) + "," + faqY + ")")
		.attr("id","modelscores")
		.attr("x", 0)
		.attr("y", 0)
		.attr("width", 15)
    	        .attr("height", 15)		
		.on("click", function(d) {
		    var name = "modelscores";					
		    self._showDialog(name);
		});
	},

	_initializeOverviewRegion: function(overviewBoxDim,overviewX,overviewY) {
	    //rectangular border for overview
	    var globalview = self.state.svg.append("rect")
		.attr("x", overviewX)
		.attr("y", overviewY)
		.attr("id", "globalview")
		.attr("height", overviewBoxDim)
		.attr("width", overviewBoxDim);
	    
	    
	    var rect_instructions = self.state.svg.append("text")		
		.attr("x", self.state.axis_pos_list[2] + 10)
	    //This changes for vertical positioning
		.attr("y", (self.state.yoffset * 2) + 50)
 		.attr("class", "instruct")
 		.text("Use the phenotype map above to");
 	    
 	    var rect_instructions = self.state.svg.append("text")
 		.attr("x", self.state.axis_pos_list[2] + 10)
 	    //This changes for vertical positioning
		.attr("y", (self.state.yoffset * 2) +  60) 
 		.attr("class", "instruct")
 		.text("navigate the model view on the left");
	},

	_createSmallScales: function(overviewRegionSize) {
	    var  sortDataList = [];
	    var self=this;
	    console.log("createSmallScales..."+self.state.phenotypeSortData.length);
	    for (i=0; i<self.state.phenotypeSortData.length; i++) {
	    	sortDataList.push(self.state.phenotypeSortData[i][0].id_a);  //rowid
	    }
	    var mods = self.state.modelList;
	    var modData = self.state.modelData;
	    console.log("phenotype sorted is..."+JSON.stringify(sortDataList));
	    
	    this.state.smallYScale = d3.scale.ordinal()
		.domain(sortDataList.map(function (d) {return d; }))				    
		.rangePoints([0,overviewRegionSize]);

	    var modids = mods.map(function (d) {return d.model_id; });
	    console.log("model ids..."+JSON.stringify(modids));
	    this.state.smallXScale = d3.scale.ordinal()
		//.domain(mods.map(function (d) {return d.model_id; }))
		.domain(modids)
		.rangePoints([0,overviewRegionSize]);
	},

	_invertOverviewDragPosition: function(scale,value) {
	    var leftEdges = scale.range();
	    var size = scale.rangeBand();
	    var  j;
	    for (j = 0; value > (leftEdges[j]+size); j++) {} // iterate until leftEdges[j]+size is past value
	    return j;
	},
		 


	
	
	_getComparisonType : function(organism){
	    var label = "";
	    
	    for (var i=0; i < this.state.comparisonTypes.length; i++) {
		{ 
		    if (organism === this.state.comparisonTypes[i].organism){
			label = this.state.comparisonTypes[i].comparison;
		    }			
		}
		if (label === "")
		    label = this.state.defaultComparisonType.comparison;		
	    }
	    return label;
	}, 
	
	_setComparisonType : function(){
	    var self = this;
	    var comp = this.state.defaultComparisonType;
	    for (var i=0; i < this.state.comparisonTypes.length; i++) {
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
	    //self.state.selectedLabel = tempdata[0].label;
	    self.state.selectedCalculation = tempdata[0].calc;
	},

	_setSelectedSort: function(type) {
	    var self = this;
	    
	    var tempdata = self.state.phenotypeSort.filter(function(d) {
	    	return d.type === type;
	    });

	    self.state.selectedSort = tempdata[0].type;
	},
	
	_processSelectedPhenotypeSort: function(){
	    var self = this;
	    
	    console.time("Start processSelectedPhenotypeSort");
	    
	    //Select phenotype sort method based on options in #sortphenotypes dropdown
	    this._filterPhenotypes(); 
	    this.state.unmatchedPhenotypes = this._getUnmatchedPhenotypes();
	    this.element.empty();
	    this.reDraw();   
	    
	    //	    console.timeEnd("End processSelectedPhenotypeSort");
	},
	
	_processSelectedCalculation: function(){
	    var self = this;
	    
	    console.time("Start processSelectedCalculation");
	    
	    this._filterCalculations(); 
	    this.state.unmatchedPhenotypes = this._getUnmatchedPhenotypes();
	    this.element.empty();
	    this.reDraw();   
	    
	    //   console.timeEnd("End processSelectedCalculation");
	},

	//given the full dataset, return a filtered dataset containing the
	//subset of data bounded by the phenotype display count and the model display count
	_filterData: function(fulldataset) {
	    
	    var phenotypeArray = this._uniquifyPhenotypes(fulldataset);
	    //copy the phenotypeArray to phenotypeData array - now instead of ALL phenotypes, it will be limited to unique phenotypes for this disease
	    //do not alter this array: this.state.phenotypeData
	    this.state.phenotypeData = phenotypeArray;

	    //we need to adjust the display counts and indexing if there are fewer phenotypes than the default phenotypeDisplayCount
	    if (this.state.phenotypeData.length < this.state.phenotypeDisplayCount) {
		this.state.currPhenotypeIdx = this.state.phenotypeData.length-1;
		this.state.phenotypeDisplayCount = this.state.phenotypeData.length;
	    }
    	    
    	    this._filterPhenotypes();
	},
	
	_filterPhenotypes: function(){
	    var self = this;
	    //Step 1: Select phenotype sort method based on options in #sortphenotypes dropdown
	    //Alphabetic: sorted alphabetically
	    //Frequency and Rarity: sorted by the sum of each phenotype across all models
	    //Frequency: sorted by the count of number of model matches per phenotype
    	    //"this.state.phenotypeSortData", is built in each sorting function
	    self.state.phenotypeSortData = [];
	    
	    switch(this.state.selectedSort) {
	    case "Alphabetic":  this._alphabetizePhenotypes();
		break;
	    case "Frequency and Rarity":    this._rankPhenotypes();
		break;
	    case "Frequency": this._sortByModelMatches();
		break;
	    default:			this._alphabetizePhenotypes();
	    }	    
	    
	    //Step 2: Filter for the next n phenotypes based on phenotypeDisplayCount and update the y-axis
	    this.state.filteredPhenotypeData = [];
	    this.state.yAxis = [];
	    this.state.filteredModelData = [];
	    //begin to sort batches of phenotypes based on the phenotypeDisplayCount
	    var startIdx = this.state.currPhenotypeIdx - (this.state.phenotypeDisplayCount -1);		
	    //extract the new array of filtered Phentoypes
	    //also update the axis
	    //also update the modeldata
	    var axis_idx = 0;
	    var tempFilteredModelData = [];
	    
	    //get phenotype[startIdx] up to phenotype[currPhenotypeIdx] from the array of sorted phenotypes
	    for (var i = startIdx;i <self.state.currPhenotypeIdx + 1;i++) {
		//move the ranked phenotypes onto the filteredPhenotypeData array
		self.state.filteredPhenotypeData.push(self.state.phenotypeSortData[i]);
		//update the YAxis   	
		//the height of each row
		var size = 10;
		//the spacing you want between rows
		var gap = 3;
		//push the rowid and ypos onto the yaxis array
		//so now the yaxis will be in the order of the ranked phenotypes
		var stuff = {"id": self.state.phenotypeSortData[i][0].id_a, "ypos" : ((axis_idx * (size+gap)) + self.state.yoffset)};
		self.state.yAxis.push(stuff); 
		axis_idx = axis_idx + 1;
		//update the ModelData			
		//find the rowid in the original ModelData (list of models and their matching phenotypes) and write it to tempdata if it matches this phenotypeSortData rowid.
		//In this case, the rowid is just the id_a value in the model data
		for (var midx = 0; midx < this.state.modelData.length; midx++) {
		    var mod = this.state.modelData[midx];
		    if (mod.id_a == self.state.phenotypeSortData[i][0].id_a) {
			tempFilteredModelData.push(mod);
		    }
		}		
	    }
	    
	    for (var idx=0;idx<self.state.filteredModelList.length;idx++) {
		for (var tdx = 0; tdx < tempFilteredModelData.length;tdx++) {
		    if (tempFilteredModelData[tdx].model_id ==
			self._getConceptId(self.state.filteredModelList[idx].model_id)) {
			self.state.filteredModelData.push(tempFilteredModelData[tdx]);
		    }
		}
	    }
	},

	_filterCalculations: function(){
	    var self = this;
	    
	    this.state.filteredModelData = [];
	    this.state.filteredPhenotypeData = [];
	    this.state.yAxis = [];
	    
	    //begin to sort batches of phenotypes based on the phenotypeDisplayCount
	    var startIdx = this.state.currPhenotypeIdx - (this.state.phenotypeDisplayCount -1);		
	    //extract the new array of filtered Phentoypes
	    //also update the axis
	    //also update the modeldata
	    var axis_idx = 0;
	    var tempFilteredModelData = [];
	    
	    //get phenotype[startIdx] up to phenotype[currPhenotypeIdx] from the array of sorted phenotypes
	    for (var i = startIdx;i <self.state.currPhenotypeIdx + 1;i++) {
		//move the ranked phenotypes onto the filteredPhenotypeData array
		self.state.filteredPhenotypeData.push(self.state.phenotypeSortData[i]);
		//update the YAxis   	
		//the height of each row
		var size = 10;
		//the spacing you want between rows
		var gap = 3;
		//push the rowid and ypos onto the yaxis array
		//so now the yaxis will be in the order of the ranked phenotypes
		var stuff = {"id": self.state.phenotypeSortData[i][0].id_a, "ypos" : ((axis_idx * (size+gap)) + self.state.yoffset)};
		self.state.yAxis.push(stuff); 
		axis_idx = axis_idx + 1;
		//update the ModelData			
		//find the rowid in the original ModelData (list of models and their matching phenotypes) and write it to tempdata if it matches this phenotypeSortData rowid.
		//In this case, the rowid is just the id_a value in the model data
		for (var midx = 0; midx < this.state.modelData.length; midx++) {
		    var mod = this.state.modelData[midx];
		    if (mod.id_a == self.state.phenotypeSortData[i][0].id_a) {
			tempFilteredModelData.push(mod);
		    }
		}		
	    }
	    
	    for (var idx=0;idx<self.state.filteredModelList.length;idx++) {
		for (var tdx = 0; tdx < tempFilteredModelData.length;tdx++) {
		    if (tempFilteredModelData[tdx].model_id ==
			self._getConceptId(self.state.filteredModelList[idx].model_id)) {
			self.state.filteredModelData.push(tempFilteredModelData[tdx]);
		    }
		}
	    }
	    
	    if (this.state.targetSpeciesName === "Overview") {
		this._finishOverviewLoad();
	    }
	    else {
		this._finishLoad(this.state.data[this.state.targetSpeciesName]);
	    }
	    
	},
	
	_uniquifyPhenotypes: function(fulldataset) {
	    var phenotypeArray = [];
	    //Step 1:  Filter data so only unique phenotypes are represented (if a source phenotype matches two
	    // different targets, only keep one of them. 
	    //Input: array of all data returned by query
	    //Output: array of the unique phentypes for this disease
	    //phenotypeArray: we should end up with an array with unique matched phenotypes
    	    for (var idx=0;idx<fulldataset.length;idx++) {
		var match =  null;
		for (var pidx = 0; pidx < phenotypeArray.length; pidx++) {
		    if (phenotypeArray[pidx].label_a == fulldataset[idx].label_a) {
			match = phenotypeArray[pidx];
			break;
		    }
		}
    		//	var result = $.grep(phenotypeArray, function(e){ return e.label_a == fulldataset[idx].label_a; });
    		//	if (result.length == 0) {
		if (match == null) {
    		    phenotypeArray.push(fulldataset[idx]);
    		}
		else {
		    //		    var resultdup = $.grep(fulldataset, function(e){ return ( (e.label_a == fulldataset[idx].label_a)  &&  (e.model_id == fulldataset[idx].model_id) )});
		    var resultdup = [];
		    for (var i = 0; i < fulldataset.length; i++) {
			if (fulldataset[i].label_a == fulldataset[idx].label_a && fulldataset[i].model_id == fulldataset[idx].model_id && i != idx) {
			    resultdup.push(fulldataset[i]);
			}
		    }
		    
		    if (resultdup.length > 1) {
			var max = 0;
			for (var i = 0; i<resultdup.length; i++){
			    if(resultdup[i].value > max) {
				max = resultdup[i].value;
			    }
			}
			//put this value back into the unique phenotype/model pair
			//should only be one of this phenotype in the phenotype array
			// do we need this check?
			if (match.value < max) {  
			    match.value = max;
			}
		    }
		}
    	    }
	    return phenotypeArray;

	},
	
	//1. Sort the array by source phenotype name
	//3. Get the number of model matches for this phenotype and add to array
	//4. Sort the array by matches. descending
	_sortByModelMatches: function() {
	    
	    var self = this;
	    var modelDataForSorting = [];
	    var modData =self.state.modelData;
	    
	    for (var idx=0;idx<self.state.phenotypeData.length;idx++) {			
		var tempdata = [];
		for (var midx = 0; midx < modData.length; midx++) {
		    if (modData[midx].id_a == self.state.phenotypeData[idx].id_a) {
			tempdata.push(modData[midx]);
		    }
		}
		modelDataForSorting.push(tempdata);
	    }
	    //sort the model list by rank
	    modelDataForSorting.sort(function(a,b) { 
		return a.id_a - b.id_a; 
	    });
	    
	    self.state.phenotypeData.sort(function(a,b) {
		return a.id_a-b.id_a;
	    });
	    
	    for (var k =0; k < modelDataForSorting.length;k++) {
		var ct  = 0;
		var d = modelDataForSorting[k];
		if (d[0].id_a == self.state.phenotypeData[k].id_a){
		    for (var i=0; i< d.length; i++)
		    {
			ct+= 1;
		    }
		    d["count"] = ct;
		    self.state.phenotypeSortData.push(d);
		}
	    }	

	    //sort the phenotype list by sum of LCS
	    self.state.phenotypeSortData.sort(function(a,b) {
		var diff = b.count -a.count;
		if (diff ==0) {// counts are equal
		    diff = a[0].id_a.localeCompare(b[0].id_a);
		}
		return diff;		    

	    });	 	
	},
	
	//`. Get all unique phenotypes in an array
	//2. Sort the array by source phenotype name
	//3. Get the sum of all of this phenotype's LCS scores and add to array
	//4. Sort the array by sums. descending
	_rankPhenotypes: function() {
	    
	    var self = this;
	    var modelDataForSorting = [];
	    
	    var modData = self.state.modelData;
	    
	    for (var idx=0;idx<self.state.phenotypeData.length;idx++) {			
		var tempdata = modData.filter(function(d) {
    	    	    return d.id_a == self.state.phenotypeData[idx].id_a;
    		});	
		modelDataForSorting.push(tempdata);
	    }
	    //sort the model list by rank
	    modelDataForSorting.sort(function(a,b) { 
	    	return a.id - b.id; 
	    });
	    
	    self.state.phenotypeData.sort(function(a,b) {
	    	return a.id_a-b.id_a;
	    });
	    
	    for (var k =0; k < modelDataForSorting.length;k++) {
		var sum  = 0;
		var d = modelDataForSorting[k];
		if (d[0].id_a === self.state.phenotypeData[k].id_a){
		    for (var i=0; i< d.length; i++)
		    {
			sum+= +d[i].subsumer_IC;
		    }
		    d["sum"] = sum;
		    self.state.phenotypeSortData.push(d);
		}
	    }		
	    //sort the phenotype list by sum of LCS
	    self.state.phenotypeSortData.sort(function(a,b) { 
	    	return b.sum - a.sum; 
	    });
	},
	
	//1. Get all unique phenotypes in an array
	//2. Sort the array by source phenotype name
	//3. Get the sum of all of this phenotype's LCS scores and add to array
	//4. Sort the array by sums. descending
	_alphabetizePhenotypes: function() {
	    var self = this;
	    var modelDataForSorting = [];

	    var modData = self.state.modelData;
	    
	    for (var idx=0;idx<self.state.phenotypeData.length;idx++) {			
		var tempdata = modData.filter(function(d) {
    	    	    return d.id_a == self.state.phenotypeData[idx].id_a;
    		});	
		modelDataForSorting.push(tempdata);
	    }
	    //sort the model list by rank
	    modelDataForSorting.sort(function(a,b) { 
		return a.id_a - b.id_a; 
	    });
	    
	    for (var k =0; k < modelDataForSorting.length;k++) {
		var sum  = 0;
		var d = modelDataForSorting[k];
		if (d[0].id_a === self.state.phenotypeData[k].id_a){
		    d["label"] = d[0].label_a;
		    self.state.phenotypeSortData.push(d);
		}
	    }		
	    
	    self.state.phenotypeSortData.sort(function(a,b) {
		var labelA = a.label.toLowerCase(), 
		    labelB = b.label.toLowerCase();
		if (labelA < labelB) {return -1;}
		if (labelA > labelB) {return 1;}
		return 0;
	    });		
	    //Save this - it works
	    //this.state.phenotypeSortData = d3.nest().key(function(d, i){return //d.label_a}).sortKeys(d3.ascending).entries(self.state.phenotypeData);	    
	},
	
	//given a list of phenotypes, find the top n models
	//I may need to rename this method "getModelData".  It should extract the models and reformat the data 
	_loadData: function() {
	    var url = '';
	    var self=this;
	    if (this.state.targetSpeciesName === "Overview") {
		this._loadOverviewData();
	    }
	    else {
		this._loadSpeciesData(this.state.targetSpeciesName);
		this._finishLoad(this.state.data[this.state.targetSpeciesName]);
	    }
	},

	_loadSpeciesData: function(speciesName,limit) {
	    var phenotypeList = this.state.phenotypeData;
	    var url = this.state.serverURL+"/simsearch/phenotype?input_items="+
		phenotypeList.join(",")+"&target_species="+
		this._getTargetSpeciesTaxonByName(this,speciesName);
	    if (typeof(limit) !== 'undefined') {
		url = url +"&limit="+limit;
	    }
	    var res = this._ajaxLoadData(speciesName,url);
	    this.state.data[speciesName]= res;
	},
	
	_loadOverviewData: function() {
	    var limit = this.state.multiOrganismCt;
	    
	    for (i in this.state.targetSpeciesList) {
		var species = this.state.targetSpeciesList[i].name;
		this._loadSpeciesData(species,limit);
		if (species === this.state.refSpecies && typeof([species]) !== 'undefined') { // if it's the one we're reffering to
		    this.state.maxICScore = this.state.data[species].metadata.maxMaxIC;
		    console.log("got max score as "+ this.state.maxICScore);
		}
		else {
		    var data = this.state.data[species];
		    if(typeof(data) !== 'undefined' && data.length < limit) {
			limit = (limit - data.length);
		    }
		}
	    }
	    //Now we have top 10 model matches for Human data in humandata, 
	    //Top n model matches for Mouse data in mousedata
	    //Top n model matches for zebrashish data in zfishdata
	    //Top n model matches for flies in flydata
	    
	    //Concat all species data and process matches
	    this._finishOverviewLoad();
	},
	
	_finishOverviewLoad : function () {
	    
	    var speciesList = [];
	    
	    var modList = [],
		orgCtr = 0;

	    for (i in this.state.targetSpeciesList) {
		var species = this.state.targetSpeciesList[i].name;
		var specData = this.state.data[species];
		if (specData != null && typeof(specData.b) !== 'undefined' &&
		    specData.b.length > 0) {
		    var data = [];
		    for (var idx= 0; idx <specData.b.length; idx++) {
			var item = specData.b[idx];
			data.push( 
			    {model_id: item.id,
			     model_label: item.label,
			     model_score: item.score.score,
			     model_rank: item.score.rank}
			);
			this._loadDataForModel(item);
		    }
		    this.state.multiOrganismCt=specData.b.length;
		    speciesList.push(species);
		    orgCtr++;
		    data.sort(function(a,b) { return a.model_rank - b.model_rank;});
		    modList =  modList.concat(data);
		}
	    }
	    
	    for (var idx=0;idx<this.state.modelData.length;idx++) {
	    	this.state.filteredModelData.push(this.state.modelData[idx]);
	    }
	    
	    this.state.modelList = modList;
	    this.state.speciesList = speciesList;
	    if (this.state.modelList.length < this.state.modelDisplayCount) {
		this.state.currModelIdx = this.state.modelList.length-1;
		this.state.modelDisplayCount = this.state.modelList.length;
	    }
	    
	    //initialize the filtered model list
	    for (var idx=0;idx<this.state.modelDisplayCount;idx++) {
	    	this.state.filteredModelList.push(this.state.modelList[idx]);
	    }
	},
	
	
	//generic ajax call for all queries
	_ajaxLoadData : function (target, url) {
	    var self = this;
	    var res;
	    jQuery.ajax({

		url: url, 
		async : false,
		dataType : 'json',
		success : function(data) {
		    res = data;
		},
		error: function ( xhr, errorType, exception ) { //Triggered if an error communicating with server  
		    self._displayResult(xhr, errorType, exception);
		},  
	    });
	    return res;
	},
	
	_displayResult : function(xhr, errorType, exception){
	    var self = this;
	    var msg = '';
	    
	    switch(xhr.status){
	    case 404:
	    case 500:
	    case 501:
	    case 502:
	    case 503:
	    case 504:
	    case 505:
	    default:
	    	msg = "We're having some problems.  Please try again soon."
	    	break;
	    	
	    case 0: msg = "Please check your network connection."
	    	break;   
		
	    }
	    
	    /**if (xhr.status === 0) {
	       msg = 'Not connected.\n Verify Network.';
	       } else if (xhr.status == 404) {
	       msg = 'The requested page was not found.';
	       } else if (xhr.status == 500) {
	       msg = 'Due to an Internal Server Error, no phenotype data was retrieved.';
	       } else if (xhr.status == 501) {
	       msg = 'The server either does not recognize the request method, or it lacks the ability to fulfill the request';
	       } else if (xhr.status == 502) {
	       msg = 'The server was acting as a gateway or proxy and received an invalid response from the upstream server.';
	       } else if (xhr.status == 503) {
	       msg = 'The server is currently unavailable (because it is overloaded or down for maintenance).';
	       } else if (xhr.status == 504) {
	       msg = 'The server was acting as a gateway or proxy and did not receive a timely response from the upstream server.';
	       } else if (xhr.status == 505) {
	       msg = 'The server does not support the HTTP protocol version used in the request.';
	       } else if (exception === 'parsererror') {
	       msg = 'Requested JSON parse failed.';
	       } else if (exception === 'timeout') {
	       msg = 'Time out error.';
	       } else if (exception === 'abort') {
	       msg = 'Ajax request aborted.';
	       } else {
	       msg = 'Uncaught Error.\n' + xhr.responseText;
	       } */

	    this._createEmptyVisualization(msg);
	},
	
	//Finish the data load after the ajax request
	//Create the modelList array: model_id, model_label, model_score, model_rank
	//Call _loadDataForModel to put the matches in an array
	_finishLoad: function(data) {
	    var retData = data;
	    //extract the maxIC score
	    if (typeof (retData.metadata) !== 'undefined') {
	    	this.state.maxICScore = retData.metadata.maxMaxIC;
	    }
	    var self= this;
	    
	    this.state.modelList = [];

	    if (typeof (retData.b)  !== 'undefined') {
		
		for (var idx=0;idx<retData.b.length;idx++) {
		    this.state.modelList.push(
			{model_id: self._getConceptId(retData.b[idx].id), 
			 model_label: retData.b[idx].label, 
			 model_score: retData.b[idx].score.score, 
			 model_rank: retData.b[idx].score.rank}
		    );
		    this._loadDataForModel(retData.b[idx]);
		}
		//sort the model list by rank
		this.state.modelList.sort(function(a,b) { 
		    return a.model_rank - b.model_rank; 
		});
		
		for (var idx=0;idx<this.state.modelData.length;idx++) {
		    this.state.filteredModelData.push(this.state.modelData[idx]);
		}
		
		//we need to adjust the display counts and indexing if there are fewer models
		if (this.state.modelList.length < this.state.modelDisplayCount) {
		    this.state.currModelIdx = this.state.modelList.length-1;
		    this.state.modelDisplayCount = this.state.modelList.length;
		    this._fixForFewerModels(this.state.modelDisplayCount);
		}
		
		this.state.filteredModelList=[];
		//initialize the filtered model list
		for (var idx=0;idx<this.state.modelDisplayCount;idx++) {
		    this.state.filteredModelList.push(this.state.modelList[idx]);
		}
	    }
	},
	
	//for a given model, extract the sim search data including IC scores and the triple:
	//the a column, b column, and lowest common subsumer
	//for the triple's IC score, use the LCS score
	_loadDataForModel: function(newModelData) {
	    //data is an array of all model matches	    
	    data = newModelData.matches;
	    
	    var species = newModelData.taxon,
	  	calculatedArray = [],
	  	normalizedArray = [],
	  	min,
	  	max,
	  	norm;
    	    
	    for (var idx=0;idx<data.length;idx++) {
	    	calculatedArray.push(this._normalizeIC(data[idx]));
	    }
	    
	    for (var idx=0;idx<data.length;idx++) {
    		
		var curr_row = data[idx],		
		    lcs = calculatedArray[idx],
	    	    new_row = {"id": this._getConceptId(curr_row.a.id) + 
			       "_" + this._getConceptId(curr_row.b.id) + 
			       "_" + this._getConceptId(newModelData.id), 
	   		       "label_a" : curr_row.a.label, 
			       "id_a" : this._getConceptId(curr_row.a.id), 
			       "IC_a" : parseFloat(curr_row.a.IC),
			       "subsumer_label" : curr_row.lcs.label, 
	    		       "subsumer_id" : this._getConceptId(curr_row.lcs.id), 
			       "subsumer_IC" : parseFloat(curr_row.lcs.IC), 
			       "value" : parseFloat(lcs),
	    		       "label_b" : curr_row.b.label, 
			       "id_b" : this._getConceptId(curr_row.b.id), 
			       "IC_b" : parseFloat(curr_row.b.IC),
			       "model_id" : this._getConceptId(newModelData.id),
	    		       "model_label" : newModelData.label, 
			       "species": species.label,
			       "taxon" : species.id,
			      }; 
		this.state.modelData.push(new_row); 
		//this.state.modelList.push(new_row);
    	    }
	},
	
	//we may use this when normalization and ranking have been determined
	_rankLCSScores : function () {
	},

	//Different methods of  based on the selectedCalculationMethod
	_normalizeIC: function(datarow){
	    var ics = [],
		aIC = datarow.a.IC,
		bIC = datarow.b.IC,
		lIC = datarow.lcs.IC,
		nic;
	    
	    var calcMethod = this.state.selectedCalculation;
	    
	    switch(calcMethod){
	    case 2: nic = lIC;
	    	//console.log("#Uniqueness-NIC: " + nic);
		break;
	    case 1: nic = ((lIC/aIC) * 100);
	    	//console.log("#RatioQ-NIC: " + nic);
		break;
	    case 0: nic = Math.sqrt((Math.pow(aIC-lIC,2)) + (Math.pow(bIC-lIC,2)));
		nic = (1 - (nic/+this.state.maxICScore)) * 100;					
		//console.log("#Similarity-NIC: " + nic);
		break;
	    case 3: nic = ((lIC/bIC) * 100);
	    	//console.log("#RatioT-NIC: " + nic);
	    	break;
	    default: nic = lIC;
	    }				
	    return nic;
	},				
	
	//create a y-axis from the model data
	//for each item in the data model, push the rowid
	//and calculate the y position
	_createYAxis: function() {
    	    
	    var self=this;
    	    //the height of each row
    	    var size = 10;
    	    //the spacing you want between rows
    	    var gap = 3;
	    
    	    //use the max phenotype size to limit the number of phenotypes shown 
    	    var yLength = self.state.phenotypeSortData.length > this.state.phenotypeDisplayCount ?
		this.state.phenotypeDisplayCount : self.state.phenotypeSortData.length;
    	    for (var idx=0;idx<yLength;idx++) {
    		var stuff = {"id": self.state.phenotypeSortData[idx][0].id_a,
			     "ypos" : ((idx * (size+gap)) + this.state.yoffset + 10)};
    		this.state.yAxis.push(stuff);
    		if (((idx * (size+gap)) + this.state.yoffset) > this.state.yAxisMax) {
    	    	    this.state.yAxisMax = (idx * (size+gap)) + this.state.yoffset;
    		}
    	    }
	},
	
	//given a rowid, return the y-axis position
	_getYPosition: function(newRowId) {
    	    var retValue = this.state.yoffset;

	    for (var i  =0; i < this.state.yAxis.length; i++) {
		if (this.state.yAxis[i].id == newRowId) {
		    retValue = this.state.yAxis[i].ypos;
		}
	    }
    	    return retValue;
	},
	
	_createColorScale: function() {
	    
	    var maxScore = 0,
		method = this.state.selectedCalculation;
	    
	    switch(method){
	    case 2: maxScore = this.state.maxICScore;
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
	    /** 3 september 2014  still a bit clunky in handling many organisms, 
		but much less hardbound. */
    	    this.state.colorScale={};
	    
	    for(var i = 0; i < this.state.targetSpeciesList.length; i++) {	
		var speciesindex;
		if (typeof(this.state.colorRanges[i]) === 'undefined') {
		    speciesindex = -1;
		}
		else  {
		    speciesindex = i;
		}  
		if (speciesindex != -1) {
		    this.state.colorScale[speciesindex] = this._getColorScale(speciesindex, maxScore);
		}
	    }
	},


	_getColorScale: function(speciesIndex,maxScore) {
	    
	    var cs =  d3.scale.linear();
	    cs.domain([3, maxScore]);
	    cs.domain(this.state.colorDomains.map(cs.invert));
	    cs.range(this.state.colorRanges[speciesIndex]);
	    return cs;
	},

	_initCanvas : function() {
    	    var self= this;

	    this._createSvgContainer();
	    var svgContainer = this.state.svgContainer;
	    svgContainer.append("<svg id='svg_area'></svg>");		
	    this.state.svg = d3.select("#svg_area");	 
	    this._addGridTitle();	  
	    this._configureFaqs();
	},

	_createSvgContainer : function() {
	    var svgContainer = $('<div id="svg_container"></div>');
	    this.state.svgContainer =  svgContainer;
	    this.element.append(svgContainer);
	},

	_addGridTitle: function() {
	    var species = '';
	    var faqWidth = 15;
	    var faqHeight = 15;

	    // set up defaults as if overview
	    var xoffset = this.state.overviewGridTitleXOffset;
	    var foffset = this.state.overviewGridTitleFaqOffset;
	    var titleText = "Cross-Species Overview";
	    
	    if (this.state.targetSpeciesName !== "Overview") {
	    	species= this.state.targetSpeciesName;
		xoffset = this.state.nonOverviewGridTitleXOffset;
	        foffset = this.state.nonOverviewGridTitleFaqOffset;
	    	var comp = this._getComparisonType(species);
		titleText = "Phenotype Comparison (grouped by " + species + " " +   comp + ")";
	    }

	    
	    var mtitle = this.state.svg.append("svg:text")
	        .attr("class","gridtitle")
		.attr("id","toptitle2")
		.attr("x",xoffset)
		.attr("y",this.state.gridTitleYOffset)
		.text(titleText);

	    // foffset is the offset to place the icon at the right of the grid title.
	    //ideally should do this by dynamically grabbing the width of mtitle,
	    // but that doesn't seem to work.
    	    var faq	= this.state.svg
		.append("svg:image")				
		.attr("xlink:href", this.state.scriptpath + "../image/greeninfo30.png")
		.attr("x",xoffset+foffset)
		.attr("id","faqinfo")
		.attr("width", faqWidth)
		.attr("height",faqHeight)		
		.on("click", function(d) {
		    var name = "faq";					
		    self._showDialog(this.state.modelName);
		});
    	    
    	    var title = document.getElementsByTagName("title")[0].innerHTML;
    	    var dtitle = title.replace("Monarch Disease:", "");


	    // place it at yoffset - the top of the rectangles with the phenotypes
            var disease = dtitle.replace(/ *\([^)]*\) */g,"");
    	    this.state.svg.append("svg:text")
	    	.attr("id","diseasetitle")
	    	.attr("y", this.state.yoffset)
	    	.text(disease);
	},
	
	
	
	/**	_addGridTitle: function() {
		var species = '';
		
		if (this.state.targetSpeciesName == "Overview") {
		var mtitle = this.state.svg.append("svg:text")
		.attr("id","toptitle")
		.attr("transform","translate(" + (this.state.colStartingPos ) + "," + (this.yoffset- 60) + ")")
		.attr("x", 0)
		.attr("y", 0)
		.text("Cross-options");
		this.state.svg.append("svg:text")
		.attr("id","bottitle")
		.attr("transform","translate(" + (this.state.colStartingPos ) + "," + (this.yoffset-20) + ")")
		.attr("x", 0)
		.attr("y", 0)
		.text("Overview");
		} else {
	    	species= this.state.targetSpeciesName;
	    	var mtitle = this.state.svg.append("svg:text")
		.attr("id","toptitle2")
		.attr("transform","translate(" + (this.state.colStartingPos ) + "," + (this.yoffset- 80) + ")")
		.attr("x", 0)
		.attr("y", 10)
		.text("Phenotype Comparison");
	    	this.state.svg.append("svg:text")
		.attr("id","bottitle2")
		.attr("transform","translate(" + (this.state.colStartingPos ) + "," + (this.yoffset-50) + ")")
		.attr("x", 0)
		.attr("y", 0)
		.text("grouped by");
	    	this.state.svg.append("svg:text")
		.attr("id","title2")
		.attr("transform","translate(" + (this.state.colStartingPos ) + "," + (this.yoffset- 25 ) + ")")
		.attr("x", 0)
		.attr("y", 0)
		.text(species);
		}
		
    		var faq	= this.state.svg
		.append("svg:image")				
		.attr("xlink:href", this.state.scriptpath + "../image/greeninfo30.png")
		.attr("transform","translate(" + (this.state.colStartingPos + 150) + "," + (this.yoffset- 35 ) + ")")
		.attr("id","faqinfo")
		.attr("x", 0)
		.attr("y", 0)
		.attr("width", 15)
	    	.attr("height", 15)		
		.on("click", function(d) {
		var name = "faq";					
		self._showDialog(name);
		});	    
		},
		
	*/	

	_configureFaqs: function() {
	    
	    var faqs = d3.selectAll("#faq")
		.on("click", function(d) {
		    self._showDialog("faq");
		});	
	    
	    var sorts = d3.selectAll("#sorts")
		.on("click", function(d,i){
		    self._showDialog( "sorts");
		});
	    
	    var calcs = d3.selectAll("#calcs")
		.on("click", function(d){
		    self._showDialog( "calcs");
		});
	},


	_resetSelections : function(type) {
	    var self = this;
	    $("#unmatchedlabel").remove();
	    $("#unmatchedlabelhide").remove();
	    $("#unmatched").remove();
	    $("#selects").remove();
	    $("#org_div").remove();
	    $("#calc_div").remove();
	    $("#sort_div").remove();
	    $("#mtitle").remove();
	    $("#header").remove();
	    $("#svg_area").remove();
	    
	    if (type === "organism"){
		self.state.phenotypeData = self.state.origPhenotypeData.slice();
		self.state.phenotypeSortData = [];
		self._reset("organism");
		self._init();
	    }
	    else if (type === "calculation"){
	    	self._reset("calculation");
	    }	
	    else if (type === "sortphenotypes"){
		self._reset("sortphenotypes");
	    }
	},
	
 	_addLogoImage :	 function() { 

	    var start = 0;
	    
	    if(this.state.filteredModelData.length < 30)
	    { start = 680; } else { start = 850;}
	    //var imgs = this.state.svg.selectAll("image").data([0]);
	    //imgs.enter()
	    this.state.svg.append("svg:image")
                .attr("xlink:href", this.state.scriptpath + "../image/logo.png")
                .attr("x", start)
                .attr("y",0)
                .attr("id", "logo")
                .attr("width", "60")
                .attr("height", "90");       
	},
	
	_resetLinks: function() {
	    //don't put these styles in css file - these stuyles change depending on state
	    this.state.svg.selectAll("#detail_content").remove();
    	    var link_lines = d3.selectAll(".data_text");
    	    link_lines.style("font-weight", "normal");
    	    link_lines.style("text-decoration", "none");
    	    link_lines.style("fill", "black");
	    link_lines.style("text-anchor", "end");
	    var link_labels = d3.selectAll(".model_label");
    	    link_labels.style("font-weight", "normal");
    	    link_labels.style("text-decoration", "none");
	    link_labels.attr("fill", "black");
	},
	
	_highlightMatchingModels : function(curr_data){
	    var self = this;
	    var models = self.state.modelData,
		alabels = this.state.svg.selectAll("text");
	    for (var i = 0; i < curr_data.length; i++){
		var label = curr_data[i].model_label;
		for (var j=0; j < alabels[0].length; j++){
		    var shortTxt = self._getShortLabel(label,15);
		    if(alabels[0][j].innerHTML == shortTxt){
		    	alabels[0][j].style.fill = "blue";
		    	alabels[0][j].innerHTML = label;
		    }			
		}
	    }	 
	},
	
	_deselectMatchingModels : function(curr_data){
	    
	    var models = this.state.modelData,
		alabels = this.state.svg.selectAll("text");
	    
	    for (var i = 0; i < curr_data.length; i++){
		var label = curr_data[i].model_label;
		for (var j=0; j < alabels[0].length; j++){
		    var shortTxt = this._getShortLabel(label,15);
		    if(alabels[0][j].innerHTML == label){
		    	alabels[0][j].style.fill = "black";
		    	alabels[0][j].innerHTML = shortTxt;
		    }			
		}
	    }	 
	},
	
	_selectModel: function(modelData, obj) {
	    var self=this;
	    console.log("model highight..."+modelData.model_label);
	    
	    //create the related model rectangles
	    var highlight_rect = self.state.svg.append("svg:rect")
		.attr("transform",
		      "translate(" + (self.state.textWidth + 32) + "," + 
		      self.state.yoffsetOver+ ")")
		.attr("x", function(d) { return (self.state.xScale(modelData.model_id)-1);})
		.attr("y", self.state.yoffset + 2)
		.attr("class", "model_accent")
		.attr("width", 14)
		.attr("height", (self.state.phenotypeDisplayCount * 13));

	    //select the model label

	    // I don't know why I'm still seeing the un-processed concept id
	    var classlabel = "text#" +this._getConceptId(modelData.model_id);
            
	    //Show that model label is selected. Change styles to bold, blue and full-length label
	    var model_label = self.state.svg.selectAll("text#" +this._getConceptId(modelData.model_id));

    	    model_label.style("font-weight", "bold");
	    model_label.style("fill", "blue");
	    model_label.html(modelData.model_label);	
	    
	    var concept = self._getConceptId(modelData.model_id),
		type = this.state.defaultApiEntity;
	    
	    for (var i =0; i < this.state.apiEntityMap.length; i++) {
		if (concept.indexOf(this.state.apiEntityMap[i].prefix) ==0) {
		    type = this.state.apiEntityMap[i].apifragment;
		}
	    }
	    
	    var width = (type === this.state.defaultApiEntity)?80:200;
	    var height = (type === this.state.defaultApiEntity)?50:60;
	    
	    var retData;
	    //initialize the model data based on the scores
	    retData = "<strong>" + self._toProperCase(type).substring(0, type.length) + ": </strong> "   
		+ modelData.model_label + "<br/><strong>Rank:</strong> " + (parseInt(modelData.model_rank) );

	    //obj = try creating an ojbect with an attributes array including "attributes", but I may need to define
	    //getAttrbitues
	    //just create a temporary object to pass to the next method...
	    var obj = {				
		attributes: [],
		getAttribute: function(keystring) {
		    var ret = self.state.xScale(modelData.model_id)+ 15;
		    if (keystring == "y") {
			ret = Number(self.state.yoffset -100);
		    }
		    return ret;
		},
            };		
	    obj.attributes['transform'] = {value: highlight_rect.attr("transform")};		
	    this._updateDetailSection(retData, this._getXYPos(obj), width, height);
	    self._highlightMatchingPhenotypes(modelData);
	},
	
	//I need to check to see if the modelData is an object.  If so, get the model_id
	
	_clearModelData: function(modelData,obj) {
	    this.state.svg.selectAll("#detail_content").remove();
	    this.state.svg.selectAll(".model_accent").remove();
	    var model_text = "",
		mod_id = "";
	    if (modelData != null && typeof modelData != 'object') {
		mod_id = this._getConceptId(modelData);   
	    } else if (typeof (modelData.model_id) !== 'undefined') {
		mod_id = this._getConceptId(modelData.model_id);
	    }
	    
	    //Show that model label is no longer selected. Change styles to normal weight, black and short label
	    if (mod_id !== "") {
		model_text = this.state.svg.selectAll("text#" + mod_id);
		model_text.style("font-weight","normal");
		model_text.style("text-decoration", "none");
		model_text.style("fill", "black");
		model_text.html(this._getShortLabel(modelData.model_label, 15));
	    }
	},
	
	_selectData: function(curr_data, obj) {    	
	    
	    //create a highlight row
	    var self=this;
	    //create the related row rectangle
	    var highlight_rect = self.state.svg.append("svg:rect")
		.attr("transform","translate(" + (self.state.axis_pos_list[1]) +"," + (self.state.yoffsetOver + 4)  + ")")
	    
		.attr("x", 12)
		.attr("y", function(d) {return self._getYPosition(curr_data[0].id_a) ;}) //rowid
		.attr("class", "row_accent")
		.attr("width", this.state.modelWidth - 4)
		.attr("height", 12);
	    
	    this._resetLinks();
	    var alabels = this.state.svg.selectAll("text.a_text." + curr_data[0].id);//this._getConceptId(curr_data[0].id));
	    var txt = curr_data[0].label_a;
	    if (txt == undefined) {
		txt = curr_data[0].id_a;
	    }
	    alabels.text(txt)
		.style("font-weight", "bold")
		.style("fill", "blue")
		.on("click",function(d){
		    //self._clickPhenotype(self._getConceptId(curr_data[0].id_a), self.document[0].location.origin);
		    self._clickPhenotype(curr_data[0].id_a, self.document[0].location.origin);
		});
	    
	    this._highlightMatchingModels(curr_data);
	    
	},
	
	
	_deselectData: function (curr_data) {
    	    
	    this.state.svg.selectAll(".row_accent").remove();
    	    this._resetLinks();
	    if (curr_data[0] == undefined) { var row = curr_data;}
	    else {row = curr_data[0];}
	    
	    //var alabels = this.state.svg.selectAll("text.a_text." + row.id); //this._getConceptId(row.id));
	    var alabels = this.state.svg.selectAll("text.a_text." + this._getConceptId(row.id));
	    alabels.text(this._getShortLabel(row.label_a));
	    data_text = this.state.svg.selectAll("text.a_text");
	    data_text.style("text-decoration", "none");
	    data_text.style("fill", "black");    
	    
	    this._deselectMatchingModels(curr_data);
	},
	
	
	_highlightMatchingPhenotypes: function(curr_data){
	    
	    var self = this;
	    var  models = self.state.modelData;
	    var curModel = this._getConceptId(curr_data.model_id);
	    for(var i = 0; i < models.length; i++){
		//models[i] is the matching model that contains all phenotypes
		if (models[i].model_id == curModel)
		{
		    var alabels = this.state.svg.selectAll("text.a_text");
		    var mtxt = models[i].label_a;
		    if (mtxt == undefined) {
			mtxt = models[i].id_a;
		    }
		    var shortTxt = self._getShortLabel(mtxt);
		    for (var j=0; j < alabels[0].length; j++){
			if (alabels[0][j].innerHTML == shortTxt){
			    alabels[0][j].style.fill = "blue";
			    break;
			}
		    }
		}			
	    }
	},		
	
	_deselectMatchingPhenotypes : function(curr_data){
	    var self = this;
	    self.state.svg.selectAll("text.a_text")
		.style("fill","black");                      
	},

	_clickPhenotype: function(data, url_origin) {
	    var url = url_origin + "/phenotype/" + data;
	    var win = window.open(url, '_blank');
	},	
	
	_clickModel: function(data, url_origin) {
	    var concept = self._getConceptId(data.model_id);
	    // hardwire check
	    var apientity = this.state.defaultApiEntity;
	    for (var i =0; i < this.state.apiEntityMap.length; i++) {
	    	if (concept.indexOf(this.state.apiEntityMap[i].prefix) ==0) {
	    	    apientity = this.state.apiEntityMap[i].apifragment;
	    	}
	    }
 	    var url = url_origin + "/"+apientity+"/" + concept;
    	    var win = window.open(url, '_blank');
	},


	//return a label for use in the list.  This label is shortened
	//to fit within the space in the column
	_getShortLabel: function(label, newlength) {
	    if (label != undefined){
	    	var retLabel = label;
	    	if (!newlength) {
	    	    newlength = this.state.textLength;
	    	}
	    	if (label.length > newlength) {
	    	    retLabel = label.substring(0,newlength-3) + "...";
		}	
	    	return retLabel;
	    }
	    else return "Unknown";
	},
	
	
	//return a useful label to use for visualizing the rectangles
	_getCleanLabel: function (uri, label) {
	    if (label && label != "" && label != "null") {
	    	return label;
	    } 
	    var temp = this._getConceptId(uri);
	    return temp;
	},

	//This method extracts the unique id from a given URI
	//for example, http://www.berkeleybop.org/obo/HP:0003791 would return HP:0003791
	//Why?  Two reasons.  First it's useful to note that d3.js doesn't like to use URI's as ids.
	//Second, I like to use unique ids for CSS classes.  This allows me to selectively manipulate related groups of items on the
	//screen based their relationship to a common concept (ex: HP000123).  However, I can't use a URI as a class.
	_getConceptId: function (uri) {
	    /*if (!uri) {
	      return "";
	      }
	      var startpos = uri.lastIndexOf("/");
	      var len = uri.length;
	      //remove the last > if there is one
	      var endpos = uri.indexOf(">") == len-1 ? len-1 : len;
	      var retString =  uri + "";
	      if (startpos != -1) {
  	      retString = uri.substring(startpos+1,endpos);
	      }
	      //replace spaces with underscores.  Classes are separated with spaces so
	      //a class called "Model 1" will be two classes: Model and 1.  Convert this to "Model_1" to avoid this problem. */
	    var retString = uri;
	    try {
		retString = retString.replace(" ", "_");
		retString = retString.replace(":", "_");
		return retString;
	    } catch (exception) {
	    }
	},

	_convertLabelHTML: function (t, label, data) {
    	    
	    var self = this;
	    var width = 100,
		el = d3.select(t),
		p = d3.select(t.parentNode),
		x = +t.getAttribute("x"),
		y = +t.getAttribute("y");

	    p.append("text")
	       	.attr('x', x + 15)
	        .attr('y', y)
	        .attr("width", width)
	    //       .attr("id", data.model_id) //this._getConceptId(data.model_id))
	        .attr("id", this._getConceptId(data.model_id))
	        .attr("model_id", data.model_id)
	        .attr("height", 60)
	        .attr("transform", function(d) {
	            return "rotate(-45)" 
	        })
		.on("click", function(d) {
		    self._clickModel(data, self.document[0].location.origin);
		})
	        .on("mouseover", function(d) {
	    	    self._selectModel(data, this);
	        })
	        .on("mouseout", function(d) {
	    	    self._clearModelData(data, d3.mouse(this));
	    	    if(self.state.selectedRow){
	    	    	self._deselectData(self.state.selectedRow);}
	        })
		.attr("class", this._getConceptId(data.model_id) + " model_label")
	    //.attr("class", data.model_id + " model_label")
		.style("font-size", "12px")
		.text( function(d) {if (label == "") return ""; else return label;});
	    
	    el.remove();
	},
	
	
	_updateDetailSection: function(htmltext, coords, width, height) {

	    this.state.svg.selectAll("#detail_content").remove();
	    
	    var w = this.state.detailRectWidth-(this.state.detailRectStrokeWidth*2) ;
	    var h = this.state.detailRectHeight-(this.state.detailRectStrokeWidth*2);
	    if (width != undefined) {
	    	w = width;
	    }
	    if (height != undefined) {
	    	h = height;
	    }
	    var wdt = this.state.axis_pos_list[1] + ((this.state.axis_pos_list[2] - this.state.axis_pos_list[1])/2);
	    var hgt = this.state.phenotypeDisplayCount*10 + this.state.yoffset, yv = 0;
	    
	    if (coords.y > hgt) { yv = coords.y - this.state.detailRectHeight - 10;}
	    else {yv = coords.y + 20;}
	    
	    console.log("putting tooltip at .."+coords.x+",..wdt is "+wdt);
	    console.log("detail width is "+this.state.detailRectWidth);
	    console.log("width is..."+width+","+w);
	    console.log("height is..."+width+","+w);
	    if (coords.x > wdt) { wv = coords.x -w - 20;}
	    else {wv = coords.x + 20;}
	    console.log("final x pos is "+wv);

	    this.state.svg.append("foreignObject")
		.attr("width", w)
		.attr("height", h)
		.attr("id", "detail_content")
	    //add an offset.  Otherwise, the tooltip turns off the mouse event
		.attr("y", yv)
		.attr("x", wv) 
		.append("xhtml:body")
		.attr("id", "detail_text")
		.html(htmltext);  	
	},
	
	_showModelData: function(d, obj) {
	    var retData;
	    /* we aren't currently using these, but we might later.*/
	    //var aSpecies = this._(d.id_a);
            //var subSpecies = this._getSpeciesLabel(d.subsumer_id);
	    //var bSpecies = this._(d.id_b);
	    
	    var species = d.species,
		taxon =   d.taxon;
	    
	    var type = this._getComparisonType(species);
	    
	    if (taxon != undefined || taxon!= null || taxon != '' || isNaN(taxon));{
		if (taxon.indexOf("NCBITaxon:") != -1) {taxon = taxon.slice(10);}
	    }
	    
	    var calc = this.state.selectedCalculation;
	    var suffix = "";
	    var prefix = "";
	    if (calc == 0 || calc == 1 || calc == 3) {suffix = '%';}
	    if (calc == 0) {prefix = "Similarity";}
	    else if (calc == 1) {prefix = "Ratio (q)";}
	    else if (calc == 2) {prefix = "Uniqueness";}
	    else if (calc == 3) {prefix = "Ratio (t)";}
	    
	    retData = "<strong>Query: </strong> " + d.label_a + " (IC: " + d.IC_a.toFixed(2) + ")"   
		+ "<br/><strong>Match: </strong> " + d.label_b + " (IC: " + d.IC_b.toFixed(2) +")"
		+ "<br/><strong>Common: </strong> " + d.subsumer_label + " (IC: " + d.subsumer_IC.toFixed(2) +")"
     		+ "<br/><strong>" + this._toProperCase(type).substring(0, type.length-1)  +": </strong> " + d.model_label
		+ "<br/><strong>" + prefix + ":</strong> " + d.value.toFixed(2) + suffix
		+ "<br/><strong>Species: </strong> " + d.species + " (" + taxon + ")";
	    this._updateDetailSection(retData, this._getXYPos(obj));
	    
	},
	
	_showThrobber: function() {
	    this.state.svg.selectAll("#detail_content").remove();
	    this.state.svg.append("svg:text")
		.attr("id", "detail_content")
		.attr("y", (26+this.state.detailRectStrokeWidth))
		.attr("x", (440+this.state.detailRectStrokeWidth))
		.style("font-size", "12px")
		.text("Searching for data")
	    this.state.svg.append("svg:image")
		.attr("width", 16)
		.attr("height", 16)
		.attr("id", "detail_content")
		.attr("y", (16+this.state.detailRectStrokeWidth))
		.attr("x", (545+this.state.detailRectStrokeWidth))
		.attr("xlink:href","/widgets/phenogrid/image/throbber.gif");	       
	},
	
	//extract the x,y values from a SVG transform string (ex: transform(200,20))
	_extractTransform: function(dataString) {
    	    var startIdx = dataString.indexOf("(");
    	    var commaIdx = dataString.indexOf(",");
    	    var x_data = Number(dataString.substring(startIdx+1,commaIdx));
    	    var y_data = Number(dataString.substring(commaIdx+1, dataString.length-1));
    	    return { x: x_data, y: y_data};
	},
	
	//the the "SVG" XY position of an element
	//The mouse position returned by d3.mouse returns the poistion within the page, not the SVG
	//area.  Therefore, this is a two step process: retreive any transform data and the (x,y) pair.
	//Return the (x,y) coordinates with the transform applied
	_getXYPos: function(obj) {
    	    var tform = { x: 0, y: 0};
    	    //if a transform exisits, apply it
    	    if (typeof obj.attributes["transform"] != 'undefined') {
		var transform_str = obj.attributes["transform"].value;
		tform = this._extractTransform(transform_str);
    	    }
	    return {x: Number(obj.getAttribute("x")) + tform.x, y: Number(obj.getAttribute("y")) + tform.y};
	},
	
	
	_getSpeciesLabel: function(idstring) {

	    var label;
	    for (var i = 0; i < this.state.speciesLabels.length; i++) {
		var labinfo = this.state.speciesLabels[i];
		if (idstring.indexOf(labinfo.abbrev) > -1) {
		    label = labinfo.label;
		    break;
		}
	    }
	    return label;
	},


	

	//NOTE: I need to find a way to either add the model class to the phenotypes when they load OR
	//select the rect objects related to the model and append the class to them.
	//something like this: $( "p" ).addClass( "myClass yourClass" );
	_createModelRects: function() {
	    var self = this;
	    var data = this.state.filteredModelData;

	    console.time("mod-rects-basics");
	    var rectTranslation = "translate(" + ((this.state.textWidth + 30) + 4) + ","
		+ (self.state.yoffsetOver + 15)+   ")";
	    var model_rects = this.state.svg.selectAll(".models")
		.data( data, function(d) {
		    return d.id;
		});
	    model_rects.enter()
		.append("rect")
		.attr("transform",rectTranslation)
		.attr("class", function(d) { 
		    var dConcept = self._getConceptId(d.id);
		    var modelConcept = self._getConceptId(d.model_id);
		    //append the model id to all related items
		    if (d.value > 0) {
			var bla = self.state.svg.selectAll(".data_text." + dConcept);	    	
			bla.classed(modelConcept, true);
		    }
		    return "models " + " " +  modelConcept + " " +  dConcept;
		})
		.attr("y", function(d, i) { 
		    return i;
		})
		.attr("x", function(d) { return self.state.xScale(d.model_id);})
		.attr("width", 10)
		.attr("height", 10)
		.attr("rx", "3")
		.attr("ry", "3")		 
	    //I need to pass this into the function
		.on("mouseover", function(d) {
		    this.parentNode.appendChild(this);		    
		    
		    //if this column and row are selected, clear the column/row and unset the column/row flag
		    if (self.state.selectedColumn != undefined && self.state.selectedRow != undefined) 
		    {
			self._clearModelData(self.state.selectedColumn);
			self.state.selectedColumn = undefined;
			self._deselectData(self.state.selectedRow);
			self.state.selectedRow = undefined;	
			if (this != self.state.currSelectedRect){
			    self._highlightIntersection(d, d3.mouse(this));
			    //put the clicked rect on the top layer of the svg so other events work
			    // ???this.parentNode.appendChild(this);
			    self._enableRowColumnRects(this);
			    //set the current selected rectangle
			    self.state.currSelectedRect = this;  
			}
		    }
		    else {
			self._highlightIntersection(d, d3.mouse(this));
			//this.parentNode.appendChild(this);
			self._enableRowColumnRects(this);
			self.state.currSelectedRect = this;  
		    }
		    self._showModelData(d, this);
		})
		.on("mouseout", function(d) {
		    self._clearModelData(data, d3.mouse(this));
		    if(self.state.selectedRow){
			self._deselectData(self.state.selectedRow);}
		})
		.style('opacity', '1.0')
		.attr("fill", function(d,i) { return self._setRectFill(self,d,i)});

	    //	    console.timeEnd("mod-rects-basics");
	    //	    console.time("highlightspec");
	    if (self.state.targetSpeciesName == "Overview") {
	    	this._highlightSpecies();
	    }
	    //	    console.timeEnd("highlightspec");
	    //	    console.time("modrects-trans");
	    model_rects.transition()
		.delay(20)
		.style('opacity', '1.0')
		.attr("y", function(d) {
		    return self._getYPosition(d.id_a)-10; //rowid
		})
		.attr("x", function(d) { return self.state.xScale(d.model_id);
				       })
	    model_rects.exit().transition()
		.style('opacity', '0.0')
		.remove();
	    //	    console.timeEnd("modrects-trans");	    
	},
	
	_highlightSpecies : function () {
	    //create the related model rectangles
	    var self = this;
	    var list = self.state.speciesList;
	    var ct = self.state.multiOrganismCt,
		vwidthAndGap = 13,
		hwidthAndGap = 18,
		totCt = 0,
		parCt = 0;
	    
	    var highlight_rect = self.state.svg.selectAll(".species_accent")
		.data(list)
		.enter()
		.append("rect")			
		.attr("transform",
		      "translate(" + (self.state.textWidth + 30) + "," +(self.state.yoffsetOver)+ ")")
	    //.attr("x", function(d,i) { return (i * (hwidthAndGap * ct));})
		.attr("x", function(d,i) { totCt += self.state.multiOrganismCt; 
					   if (i==0) { return 0; }
					   else {parCt = totCt - self.state.multiOrganismCt;  
						 return hwidthAndGap * parCt;}})
		.attr("y", self.state.yoffset)
		.attr("class", "species_accent")
		.attr("width",  function(d,i) { return (hwidthAndGap * self.state.multiOrganismCt);})
		.attr("height", vwidthAndGap * self.state.phenotypeDisplayCount + 5)
		.attr("stroke", "black")
		.attr("stroke-width", 3)
		.attr("fill", "none");
	},
	
	
	_enableRowColumnRects :  function(curr_rect){
	    var self = this;
	    
	    var model_rects = self.state.svg.selectAll("rect.models")
		.filter(function (d) { return d.rowid == curr_rect.__data__.rowid;});
	    for (var i = 0; i < model_rects[0].length; i++){
		model_rects[0][i].parentNode.appendChild(model_rects[0][i]);
	    }
	    var data_rects = self.state.svg.selectAll("rect.models")
		.filter(function (d) { return d.model_id == curr_rect.__data__.model_id;});
	    for (var j = 0; j < data_rects[0].length; j++){
		data_rects[0][j].parentNode.appendChild(data_rects[0][j]);
	    }
	},
	
	_getFirstModelId:  function(phenotype){
	    var firstModel=""; 
	    for(var i=0; i < this.state.filteredModelData.length; i++){
		if (this.state.filteredModelData[i].id_a === phenotype){
		    firstModel = this.state.filteredModelData[i].id;
		    break;
		}
	    }
	    return firstModel;	
	},
	
	_highlightIntersection : function(curr_data, obj){
	    var self=this;
	    
	    //Highlight Row
	    var highlight_rect = self.state.svg.append("svg:rect")
		.attr("transform","translate(" + self.state.axis_pos_list[1] + ","+ (self.state.yoffsetOver + 4 ) + ")")
		.attr("x", 12)
		.attr("y", function(d) {return self._getYPosition(curr_data.id_a) ;}) //rowid
		.attr("class", "row_accent")
		.attr("width", this.state.modelWidth - 4)
		.attr("height", 12);
	    
    	    this.state.selectedRow = curr_data;
	    this.state.selectedColumn = curr_data;
	    this._resetLinks();
	    
	    //To get the phenotype label from the selected rect data, we need to concat the phenotype ids to the model id 
	    // that is in the 0th position in the grid. No labels exist with the curr_data.id except for the first column
	    //For the overview, there will be a 0th position for each species so we need to get the right model_id
	    
	    var species = curr_data.species,
	    	mid = this._getFirstModelId(curr_data.id_a),
	    	//fakeId = mid,
	    	phen_label = this.state.svg.selectAll("text.a_text." + this._getConceptId(mid)),
	    	txt = curr_data.label_a;
	    if (txt == undefined) {
	    	txt = curr_data.id_a;
	    }
	    phen_label.text(txt)
	    	.style("font-weight", "bold")
	    	.style("fill", "blue");
	    //.on("click",function(d){
	    //self._clickPhenotype(curr_data.id_a, self.document.location.origin);
	    // });
	    
	    //Highlight Column
	    var model_label = self.state.svg.selectAll("text#" + this._getConceptId(curr_data.model_id));
	    model_label.style("font-weight", "bold");
	    model_label.style("fill", "blue");

	    //create the related model rectangles
	    var highlight_rect2 = self.state.svg.append("svg:rect")
		.attr("transform",
		      "translate(" + (self.state.textWidth + 34) + "," +self.state.yoffsetOver+ ")")
		.attr("x", function(d) { return (self.state.xScale(curr_data.model_id) - 1);})
		.attr("y", self.state.yoffset + 2 )
		.attr("class", "model_accent")
		.attr("width", 12)
		.attr("height", (self.state.phenotypeDisplayCount * 13));
	},
	
	_updateAxes: function() {
	    var self = this;
	    var data = [];
	    
	    //This is for the new "Overview" target option 
	    if (this.state.targetSpeciesName == "Overview"){	
	    	data = this.state.modelData;
	    }
	    else
	    {
	    	data = self.state.filteredModelData;	
	    }
	    this.state.h = (data.length*2.5);

	    self.state.yScale = d3.scale.ordinal()
                .domain(data.map(function (d) {return d.id_a; }))
		.range([0,data.length])
                .rangePoints([ self.state.yModelRegion,self.state.yModelRegion +this.state.h ]);


	    //update accent boxes
	    self.state.svg.selectAll("#rect.accent").attr("height", self.state.h);
	},

	
	
	//NOTE: FOR FILTERING IT MAY BE FASTER TO CONCATENATE THE PHENOTYPE and MODEL into an attribute
	
	//change the list of phenotypes and filter the models accordingly.  The 
	//movecount is an integer and can be either positive or negative
	_updateModel: function(modelIdx, phenotypeIdx) {
	    var self = this;
	    //This is for the new "Overview" target option 
	    var modelData = [].
		modelList = [];
	    modelData = this.state.modelData;
	    modelList = this.state.modelList;

	    //check to see if the phenotypeIdx is greater than the number of items in the list
	    if (phenotypeIdx > this.state.phenotypeData.length) {
		this.state.currPhenotypeIdx = this.state.phenotypeSortData.length;
	    } else if (phenotypeIdx - (this.state.phenotypeDisplayCount -1) < 0) {
		//check to see if the min of the slider is less than the 0
		this.state.currPhenotypeIdx = (this.state.phenotypeDisplayCount -1);
	    } else {
		this.state.currPhenotypeIdx = phenotypeIdx;
	    }
	    var startPhenotypeIdx = this.state.currPhenotypeIdx - this.state.phenotypeDisplayCount;
	    
	    this.state.filteredPhenotypeData = [];
	    this.state.yAxis = [];
	    
	    //fix model list
	    //check to see if the max of the slider is greater than the number of items in the list
	    if (modelIdx > modelList.length) {
		this.state.currModelIdx = modelList.length;
	    } else if (modelIdx - (this.state.modelDisplayCount -1) < 0) {
		//check to see if the min of the slider is less than the 0
		this.state.currModelIdx = (this.state.modelDisplayCount -1);
	    } else {
		this.state.currModelIdx = modelIdx;
	    }
	    var startModelIdx = this.state.currModelIdx - this.state.modelDisplayCount;

	    this.state.filteredModelList = [];
	    if (this.state.targetSpeciesName !== "Overview") { this.state.filteredModelData = [];}
	    
	    //extract the new array of filtered Phentoypes
	    //also update the axis
	    //also update the modeldata

	    var tempFilteredModelData = [];
	    var axis_idx = 0;
    	    for (var idx=startModelIdx;idx<self.state.currModelIdx;idx++) {
    		self.state.filteredModelList.push(modelList[idx]);
    	    }
	    
	    //extract the new array of filtered Phentoypes
	    //also update the axis
	    //also update the modeldata

	    var tempFilteredModelData = [];
	    var axis_idx = 0;
    	    for (var idx=startPhenotypeIdx;idx<self.state.currPhenotypeIdx;idx++) {
    		self.state.filteredPhenotypeData.push(self.state.phenotypeSortData[idx]);
    		//update the YAxis   	    		
    		//the height of each row
        	var size = 10;
        	//the spacing you want between rows
        	var gap = 3;

    		var stuff = {"id": self.state.phenotypeSortData[idx][0].id_a, 
			     "ypos" : ((axis_idx * (size+gap)) + self.state.yoffset)};
    		self.state.yAxis.push(stuff); 
    		axis_idx = axis_idx + 1;
    		//update the ModelData
    		var tempdata = modelData.filter(function(d) {
    	    	    return d.id_a == self.state.phenotypeSortData[idx][0].id_a;
    		});
    		tempFilteredModelData = tempFilteredModelData.concat(tempdata);
    	    }

    	    self.state.svg.selectAll("g .x.axis")
		.remove();
	    self.state.svg.selectAll("g .tick.major")
		.remove();
	    //update the x axis
	    self.state.xScale = d3.scale.ordinal()
		.domain(self.state.filteredModelList.map(function (d) {
		    return d.model_id; }))
	        .rangeRoundBands([0,self.state.modelWidth]);
	    this._createModelLabels(self);
	    
	    //The pathline creates a line  below the labels. We don't want two lines to show up so fill=white hides the line.
	    this._createModelLines();
	    this._createTextScores(this.state.filteredModelList);
	    
	    if (self.state.targetSpeciesName == "Overview") {
	    	this._createOverviewSpeciesLabels();
	    }
	    
	    if (this.state.targetSpeciesName !== "Overview") {
		//now, limit the data returned by models as well
		for (var idx=0;idx<self.state.filteredModelList.length;idx++) {
	    	    var tempdata = tempFilteredModelData.filter(function(d) {
	    	    	return d.model_id == self.state.filteredModelList[idx].model_id;
	    	    });
	    	    self.state.filteredModelData = self.state.filteredModelData.concat(tempdata);   		
		}	
	    }
	    
	    this._createModelRects();
	    this._createRowLabels();
	},

	_createModelLabels: function(self) {
	    var    model_x_axis = d3.svg.axis().scale(self.state.xScale).orient("top");

	    self.state.svg.append("g")
	  	.attr("transform","translate(" + (self.state.textWidth +28) +"," + 
		      self.state.yoffset + ")")
	  	.attr("class", "x axis")
	  	.call(model_x_axis)			
	    //this be some voodoo...
	    //to rotate the text, I need to select it as it was added by the axis
	  	.selectAll("text") 
	  	.each(function(d,i) { 
	  	    self._convertLabelHTML(this, self._getShortLabel(self.state.filteredModelList[i].model_label, 15),self.state.filteredModelList[i]);}); 
	},
	

	_createModelLines: function() {

	    var modelLineGap = 10;
	    var lineY = this.state.yoffset-modelLineGap;
	    this.state.svg.selectAll("path.domain").remove();	
	    this.state.svg.selectAll("text.scores").remove();
	    this.state.svg.selectAll("#specieslist").remove();

	    this.state.svg.append("line")
		.attr("transform","translate(" + (this.state.textWidth + 30) +"," + lineY + ")")
		.attr("x1", 0)
		.attr("y1", 0)
		.attr("x2", this.state.modelWidth)
		.attr("y2", 0)
		.attr("stroke", "#0F473E")
		.attr("stroke-width", 1);

	},

	_createTextScores: function(list) {
	    var self =this;
	    var translation ="translate(" + (this.state.textWidth + 34) +"," 
		+ this.state.yoffset + ")"; // was yoffset -3
	    this.state.svg.selectAll("text.scores")
		.data(list) 
		.enter()	
		.append("text")
		.attr("transform",translation)
    	        .attr("id", "scorelist")
		.attr("x",function(d,i){return i*18})
		.attr("y", 0)
		.attr("width", 18)
    	        .attr("height", 10)
		.attr("class", "scores")
		.text(function (d,i){return self.state.filteredModelList[i].model_score;});
	},

	//Add species labels to top of Overview
	_createOverviewSpeciesLabels: function () {
	    var self = this;
	    
	    var speciesList = self.state.speciesList;

	    var translation = "translate(" + (self.state.textWidth + 30) +"," + 
		(self.state.yoffset + 10) + ")";

	    var xPerModel = self.state.modelWidth/speciesList.length;
	    var species = self.state.svg.selectAll("#specieslist")
		.data(speciesList)
		.enter()
		.append("text")
		.attr("transform",translation)
		.attr("x", function(d,i){ return (i+1/2)*xPerModel;})
	    // return ((i+1) * xPerModel ) - 
	    //(xPerModel/2);})
		.attr("id", "specieslist")
		.attr("y", 10)
		.attr("width", xPerModel) // function(d,i){return xPerModel;})
		.attr("height", 10)
		.attr("fill", "#0F473E")
		.attr("stroke-width", 1)
		.text(function (d,i){return speciesList[i];})
		.attr("text-anchor","middle");
	},

	// we might want to modify this to do a dynamic http retrieval to grab the dialog components...
	_showDialog : function(name){
	    var self= this;
	    var url = this._getResourceUrl(name,'html'); 
	    if (typeof(self.state.tooltips[name]) === 'undefined') {
		$.ajax( {url: url,
			 dataType: 'html',
			 async: 'false',
			 success: function(data) {
			     self._populateDialog(self,name,data);
			 },
			 error: function ( xhr, errorType, exception ) { //Triggered if an error communicating with server  
			     self._populateDialog(self,"Error", "We are having problems with the server. Please try again soon. Error:" + xhr.status);
			 },
			});
	    }
	    else {
		this._populateDialog(self,name,self.state.tooltips[name]);
	    }
	},

	_populateDialog: function(self,name,text) {
	    var SplitText = "Title";
	    var $dialog = $('<div></div>')
		.html(SplitText )
		.dialog({
		    modal: true,
		    minHeight: 200,
		    maxHeight: 400,
		    minWidth: 400,
		    resizable: true,
		    draggable:true,
		    position: ['center', 'center'],
		    title: 'Phenogrid Notes'});
	    
	    $dialog.dialog('open');
	    $dialog.html(text);	
	    self.state.tooltips[name]=text;
	},
	
	/**
	 * Build the three main left-right visual components: the rectangle containing the 
	 * phenotypes, the main grid iself, and the right-hand side including the overview and color 
	 *   scales
	 *
	 */
	_createRectangularContainers: function() {
	    var self=this;
	    
	    this._buildAxisPositionList();
	    //if (self.state.targetSpeciesName === "Overview") {self.state.yoffsetOver = 35;}
	    //else {yoffsetOver = 0;}
	    var gridHeight = self.state.phenotypeDisplayCount * 13 + 10;
	    var y = self.state.yModelRegion;
	    //create accent boxes
	    var rect_accents = this.state.svg.selectAll("#rect.accent")
		.data([0,1,2], function(d) { return d;});
	    rect_accents.enter()
	    	.append("rect")
		.attr("class", "accent")
		.attr("x", function(d, i) { return self.state.axis_pos_list[i];})
		.attr("y", y)
		.attr("width", self.state.textWidth+5)
		.attr("height",  gridHeight)
		.attr("id", function(d, i) {
		    if(i==0) {return "leftrect";} else if(i==1) {return "centerrect";} else {return "rightrect";}
		})	
		.style("opacity", '0.4')
		.attr("fill", function(d, i) {
		    return i != 1 ? d3.rgb("#e5e5e5") : "white"; 
		});
	    
	    //Is this ct necessary? What does it do?
	    if (self.state.targetSpeciesName == "Overview") { var ct = 0;}
	    else { var ct = -15;}
	    
	},


	/* Build out the positions of the 3 boxes 
	 * TODO: REMOVE MAGIC NUMBERS... 
	 */
	
	_buildAxisPositionList: function() {
	    //For Overview of Organisms 0 width = ((multiOrganismCt*2)+2) *18	
	    //Add two  extra columns as separators
	    this.state.axis_pos_list = [];

	    // calculate width of model section
	    this.state.modelWidth = this.state.filteredModelList.length * 
		this.state.widthOfSingleModel;
	    //add an axis for each ordinal scale found in the data
	    for (var i=0;i<3;i++) {
	    	//move the last accent over a bit for the scrollbar
		if (i == 2) {
		    // make sure it's not too narrow i
		    var w = this.state.modelWidth;
		    if(w < this.state.smallestModelWidth) {
			w = this.state.smallestModelWidth;
		    }
		    this.state.axis_pos_list.push((this.state.textWidth + 30) 
						  + this.state.colStartingPos 
						  + w);
		} else {
		    this.state.axis_pos_list.push((i*(this.state.textWidth + 10)) + 
						  this.state.colStartingPos);
		}
	    }	
	},

	
	//this code creates the colored rectangles below the models
	_createModelRegion: function () {

	    var self=this;
	    var list = [];

	    //This is for the new "Overview" target option 
	    if (this.state.targetSpeciesName == "Overview"){
	    	list = this.state.modelList;
	    }
	    else
	    {
	    	list = this.state.filteredModelList;
	    }

	    console.time("rangerounds");
	    this.state.xScale = d3.scale.ordinal()
		.domain(list.map(function (d) {
		    return d.model_id; })).rangeRoundBands([0,this.state.modelWidth]);
	    //	    console.timeEnd("rangerounds");	    

	    //	    console.time("modellabels");
	    this._createModelLabels(self);
	    //	    console.timeEnd("modellabels");

	    //	    console.time("modellines");
	    this._createModelLines();
	    //	    console.timeEnd("modellines");
	    
	    //	    console.time("textscores");
	    this._createTextScores(list);
	    //	    console.timeEnd("textscores");

	    //	    console.time("col");
	    if (self.state.targetSpeciesName == "Overview") {
	        this._createOverviewSpeciesLabels();		
	    }
	    //	    console.timeEnd("col");
	    
	    //var modData = [];
	    
	    //modData =this.state.modelData.slice();
	    var modData = this.state.modelData;

	    //	    console.time("moddiff");
	    var temp_data = modData.map(function(d) { 
	    	return d.value;}
				       );
	    var diff = d3.max(temp_data) - d3.min(temp_data);
	    //	    console.timeEnd("moddiff");

	    // indicator for bottom of gradients
	    var ymax = 0;
	    
	    //only show the scale if there is more than one value represented
	    //in the scale
	    if (diff > 0) {
		// baseline for gradient positioning
		var y1 = 262;  
		//more magic data
		if (this.state.filteredPhenotypeData.length < 14) {
		    y1=172;  
		} 

		ymax = this._buildGradientDisplays(y1);
		this._buildGradientTexts(y1);
	    }					

	    //	    console.time("pgcontrols");
	    var phenogridControls = $('<div id="phenogrid_controls"></div>');
	    this.element.append(phenogridControls);
	    this._createSelectionControls(phenogridControls); 
	    //	    console.timeEnd("pgcontrols");

	    return ymax;
	},

	/**
	 * build the gradient displays used to show the range of colors
	 */
	_buildGradientDisplays: function(y1) {
	    var ymax = 0;

	    console.time("creategrads");
	    //If this is the Overview, get gradients for all species with an index
	    if (this.state.targetSpeciesName == "Overview" || 
	    	this.state.targetSpeciesName == "All") {
		
		//this.state.overviewCount tells us how many fit in the overview
		for (var i = 0; i < this.state.overviewCount; i++) {	
		    var y = this._createGradients(i,y1);
		    if (y  > ymax) {
			ymax = y;
		    }
		}
	    }
	    else {  //This is not the overview - determine species and create single gradient
		var i = this._getTargetSpeciesIndexByName(this,this.state.targetSpeciesName);
		var y  = this._createGradients(i,y1);
		if (y > ymax) {
		    ymax = y;
		}
	    }
	    console.log("ymax is "+ymax);
	    return ymax;
	},

	/*
	 * add the gradients to the grid, returning the max x so that
	 * we know how much space the grid will need vertically on the
	 * right.  This is important because this region will extend 
	 * below the main grid if there are only a few phenotypes.
	 *
	 * y1 is the baseline for computing the y position of the
	 *    gradient
	 */
	_createGradients: function(i, y1){
	    self=this;
	    
	    var y;
	    var gradientHeight=20;
	    
	    console.time("gradientappend");
	    var gradient = this.state.svg.append("svg:linearGradient")
		.attr("id",  "gradient_" + i)
		.attr("x1", "0")
		.attr("x2", "100%")
		.attr("y1", "0%")
		.attr("y2", "0%");
	    for (j in this.state.colorDomains)
	    {
		gradient.append("svg:stop")
		    .attr("offset", this.state.colorDomains[j])
		    .style("stop-color", this.state.colorRanges[i][j])
		    .style("stop-opacity", 1);				
	    }
	    //	    console.timeEnd("gradientappend");

	    //	    console.time("gradientlabs");
	    /* gradient + gap is 20 pixels */
	    var y = y1 + (gradientHeight * i) +  self.state.yoffset;
	    var  x = self.state.axis_pos_list[2] + 12;
	    var translate  = "translate(0,10)";
	    var legend = this.state.svg.append("rect")
		.attr("transform",translate)
		.attr("class", "legend_rect_" + i)
		.attr("id","legendscale_" + i)
		.attr("y", y)
		.attr("x", x)
		.attr("rx",8)
		.attr("ry",8)
		.attr("width", 180)
		.attr("height", 15)
		.attr("fill", "url(#gradient_" + i + ")");

	    
	    /* text is 20 below gradient */
	    y =  y1 + gradientHeight*(i+1) + self.state.yoffset;
	    x = self.state.axis_pos_list[2] + 205;
	    var gclass = "grad_text_"+i;
	    var specName = this.state.targetSpeciesList[i].name;
	    var grad_text = self.state.svg.append("svg:text")
		.attr("class", gclass)
		.attr("y", y)
		.attr("x", x)
		.style("font-size", "11px")
		.text(specName);
	    //	    console.timeEnd("gradientlabs");
	    
	    y = y+gradientHeight;
	    
	    return y;

	},

	/***
	 * Show the labels next to the gradients, including
	 * descriptions of min and max sides 
	 * y1 is the baseline to work from
	 */
	_buildGradientTexts: function(y1) {
	    var calc = this.state.selectedCalculation,
		text1 = "",
		text2 = "",
		text3 = "";
	    
	    if (calc == 2) {text1 = "Lowest"; text2 = "Uniqueness"; text3 = "Highest";}
	    else if (calc == 1) {text1 = "Less Similar"; text2 = "Ratio (q)"; text3 = "More Similar";}
	    else if (calc == 3) {text1 = "Less Similar"; text2 = "Ratio (t)"; text3 = "More Similar";}
	    else if (calc == 0) {text1 = "Min"; text2 = "Similarity"; text3 = "Max";}
	    
	    console.time("mrtexts");
	    var ytext1 =  y1  + self.state.yoffset-5;
	    var xtext1= self.state.axis_pos_list[2] + 10;
	    var div_text1 = self.state.svg.append("svg:text")
		.attr("class", "detail_text")
		.attr("y", ytext1)
		.attr("x", xtext1)
		.style("font-size", "10px")
		.text(text1);
	    
	    var ytext2 = y1-10  +  self.state.yoffset;
	    var xtext2  = self.state.axis_pos_list[2] + 75;
	    var div_text2 = self.state.svg.append("svg:text")
		.attr("class", "detail_text")
		.attr("y", ytext2)
		.attr("x", xtext2)
		.style("font-size", "12px")
		.text(text2);
	    
	    var ytext3 = y1 + self.state.yoffset-5;
	    var xtext3 = self.state.axis_pos_list[2] + 125;
	    var div_text3 = self.state.svg.append("svg:text")
		.attr("class", "detail_text")
		.attr("y", ytext3)
		.attr("x", xtext3)
		.style("font-size", "10px")
		.text(text3);
	    //	    console.timeEnd("mrtexts");
	    
	    //Position the max more carefully	
	    if (text3 == "Max") {
		div_text3.attr("x",self.state.axis_pos_list[2] + 150);			
	    }
	    if (text3 == "Highest") {
		div_text3.attr("x",self.state.axis_pos_list[2] + 150);			
	    }
	},

	/**
	 * build controls for selecting organism and
	 comparison. Install handlers
	 * 
	 */
	_createSelectionControls: function(container) {
	    
	    var optionhtml ='<div id="selects"></div>';
	    var options = $(optionhtml);
	    var orgSel = this._createOrganismSelection();
	    options.append(orgSel);
	    var sortSel = this._createSortPhenotypeSelection();
	    options.append(sortSel);
	    var calcSel = this._createCalculationSelection();
	    options.append(calcSel);
	    container.append(options);
	    //add the handler for the select control
	    $( "#organism" ).change(function(d) {
		//msg =  "Handler for .change()
		//called." );
		self.state.targetSpeciesName = 
		    self._getTargetSpeciesNameByIndex(self,d.target.selectedIndex);
		self._resetSelections("organism");
	    });
	    
	    $( "#calculation" ).change(function(d) {
	    	self.state.selectedCalculation = 
	    	    self.state.similarityCalculation[d.target.selectedIndex].calc;
	    	self._resetSelections("calculation");
	    	self._processSelectedCalculation();
	    });	
	    
	    //add the handler for the select control
            $( "#sortphenotypes" ).change(function(d) {
        	self.state.selectedSort = self.state.phenotypeSort[d.target.selectedIndex].type;
        	self._resetSelections("sortphenotypes");
        	self._processSelectedPhenotypeSort();
            });


	},
	
	/**
	 * construct the HTML needed for selecting organism
	 */
	_createOrganismSelection: function(selClass) {
	    var selectedItem="";
	    var optionhtml = "<div id='org_div'><span id='olabel'>Species</span>"+
		"<span id='org_sel'><select id=\'organism\'>";

	    for (var idx=0;idx<this.state.targetSpeciesList.length;idx++) {
		var selecteditem = "";
		if (this.state.targetSpeciesList[idx].name === this.state.targetSpeciesName) {
		    selecteditem = "selected";
		}
		optionhtml = optionhtml +
		    "<option value=\""+this.state.targetSpeciesList[idx.name]+
		    "\" " + selecteditem +">" + this.state.targetSpeciesList[idx].name +"</option>"
	    }
	    // add one for overview.
	    if (this.state.targetSpeciesName === "Overview") {
	    	selecteditem = "selected";
	    } else {
	    	selecteditem = "";
	    }
	    optionhtml = optionhtml + "<option value=\"Overview\" "+ selecteditem +">Overview</option>";
	    
	    optionhtml = optionhtml + "</select></span></div>";
	    return $(optionhtml);
	},


	/** 
	 * create the html necessary for selecting the calculation 
	 */

	_createCalculationSelection: function () {
	    
	    var optionhtml = "<span id='calc_div'><span id='clabel'>Display<span id='calcs'><img class='calcimg' src='" +
		this.state.scriptpath +  "../image/greeninfo30.png' height='15px'></span><span id='calc'></span></span><br />";

	    optionhtml = optionhtml+"<span id=\'calc_sel\'><select id=\"calculation\">";
	    for (var idx=0;idx<this.state.similarityCalculation.length;idx++) {
		var selecteditem = "";
		if (this.state.similarityCalculation[idx].calc === this.state.selectedCalculation) {
		    selecteditem = "selected";
		}
		optionhtml = optionhtml + "<option value='" +
		    this.state.similarityCalculation[idx].calc +"' "+ selecteditem +">" +
		    this.state.similarityCalculation[idx].label +"</option>";
	    }
	    optionhtml = optionhtml + "</select></span></span>";
	    return $(optionhtml);
	},
	
	//_buildSortSelector: function() {
	_createSortPhenotypeSelection: function () {
	    var optionhtml ="<span id='sort_div'>"+
		"<span id='slabel' >Sort Phenotypes<span id=\"sorts\">"+
		"<img class=\"sortimg\" src=\"" +this.state.scriptpath + 
		"../image/greeninfo30.png\" height=\"15px\"></span>"+
		"<span id='sort'></span></span><br />"+
		"<span><select id=\'sortphenotypes\'>";
	    
	    for (var idx=0;idx<this.state.phenotypeSort.length;idx++) {
    		var selecteditem = "";
    		if (this.state.phenotypeSort[idx].type === this.state.selectedSort) {
    		    selecteditem = "selected";
    		}
		optionhtml = optionhtml + "<option value='" + 
		    this.state.phenotypeSort[idx].order +
		    "' "+ selecteditem +">" + this.state.phenotypeSort[idx].type +"</option>";
	    }
	    optionhtml = optionhtml + "</select></span>";			
	    return $(optionhtml);
	},

	//this code creates the text and rectangles containing the text 
	//on either side of the model data
	_createRowLabels: function() {
	    // this takes some 'splaining
	    //the raw dataset contains repeats of data within the
	    //A,subsumer, and B columns.   
	    //If d3 sees the same label 4 times (ex: Abnormality of the
	    //pharynx) then it will 
	    //create a rectangle and text for it 4 times.  Therefore, I
	    //need to create a unique set of  
	    //labels per axis (because the labels can repeat across axes)
	    
	    
	    var self=this;
	    
	    var rect_text = this.state.svg
		.selectAll(".a_text")
		.data(self.state.filteredPhenotypeData, function(d, i) {  return d[0].id_a; });//rowid
	    rect_text.enter()
		.append("text")
		.attr("class", function(d) {
		    return "a_text data_text " + d[0].id;//self._getConceptId(d[0].id);
		})
	    //store the id for this item.  This will be used on click events
		.attr("ontology_id", function(d) {
		    return d[0].id_a; //self._getConceptId(d[0].id_a);   
		})
		.attr("x", 208)
		.attr("y", function(d,i) {
		    //return i;
		    return self._getYPosition(d[0].id_a)+10;
		})
		.on("mouseover", function(d) {
		    self._selectData(d, d3.mouse(this));
		})
		.on("mouseout", function(d) {
		    self._deselectData(d, d3.mouse(this));
		})
		.attr("width", self.state.textWidth)
		.attr("height", 50)
		.text(function(d) {
		    var txt = d[0].label_a;
		    if (txt == undefined) {
		    	txt = d[0].id_a;
		    }
		    return self._getShortLabel(txt);
		})

	    this._buildUnmatchedPhenotypeDisplay();
	    
	    //   if (this.state.targetSpeciesName == "Overview") {var pad = 14;}
	    // else { var pad = 10;}
	    var pad =14;
	    
	    rect_text.transition()
   		.style('opacity', '1.0')
		.delay(5)
		.attr("y", function(d) {
		    //controls position of phenotype list
		    newy = self._getYPosition(d[0].id_a) + (self.state.yoffsetOver) + pad;
		    return newy;
		})
	    rect_text.exit()
	   	.transition()
	   	.delay(20)
	   	.style('opacity', '0.0')
		.remove();
	},


	_getUnmatchedPhenotypes : function(){
	    
	    var fullset = this.state.origPhenotypeData,
		partialset = this.state.phenotypeSortData,
		full = [],
		partial = [],
		matchedset = [],
		unmatchedset = [];

	    
	    for (i=0; i < fullset.length; i++) {
		full.push(fullset[i]);
	    }
	    for (j=0; j < partialset.length; j++) {
		partial.push((partialset[j][0].id_a).replace("_", ":"));
	    }
	    for (k=0; k <full.length; k++) {
		//if no match in fullset
		if (partial.indexOf(full[k].id) < 0) {	
		    //if there unmatched set is empty, add this umatched phenotype
		    unmatchedset.push(full[k]);
		}
	    }
	    var dupArray = [];
	    dupArray.push(unmatchedset[0]);	
	    //check for dups
	    for ( i=1; i < unmatchedset.length;i++){
		var found = false;
		for (var j = 0; j < dupArray.length; j++) {
		    if (dupArray[j].id == unmatchedset[i].id) {
			found = true;
		    }
		}
		if (found == false) {
		    dupArray.push(unmatchedset[i]);
		}
	    }					
	    if (dupArray[0] == undefined) {dupArray = []};
	    
	    return dupArray;
	},
	
	_getUnmatchedLabels: function() {
	    var unmatchedLabels = [];
	    for (i=0;i<this.state.unmatchedPhenotypes.length; i++){
		
		jQuery.ajax({
		    url : this.state.serverURL + "/phenotype/" + this.state.unmatchedPhenotypes[i] + ".json",
		    async : false,
		    dataType : 'json',
		    success : function(data) {
			unmatchedLabels.push(data.label);
		    },
		    error: function ( xhr, errorType, exception ) { //Triggered if an error communicating with server  
			self._populateDialog(self,"Error", "We are having problems with the server. Please try again soon. Error:" + xhr.status);				
		    },
		});
	    }
	    return unmatchedLabels;
	},
	
	_getPhenotypeLabel : function(id){
	    var label = "";
	    
	    for (i=0; i < this.state.phenotypeSortData.length; i++){
		if(id == this.state.phenotypeSortData[i][0].id_a.replace("_",":"))
		{ 
		    label = this.state.phenotypeSortData[i][0].label_a;
		    break;
		}
	    }
	    return label;
	}, 

	_buildUnmatchedPhenotypeDisplay: function() {
	    var self=this;
	    
	    var prebl = $("#prebl");
	    if (prebl.length == 0) {
		var preblHtml ="<div id='prebl'></div>";
		this.element.append(preblHtml);
		prebl = $("#prebl");
	    }
	    prebl.empty();
	    
	    if (this.state.unmatchedPhenotypes != undefined && this.state.unmatchedPhenotypes.length > 0){
	    	//var phenotypes = this._showUnmatchedPhenotypes();		
		var optionhtml = "<div class='clearfix'><form id='matches'><input type='checkbox' name='unmatched' value='unmatched' >&nbsp;&nbsp;View Unmatched Phenotypes<br /><form><div id='clear'></div>";
		var phenohtml = this._buildUnmatchedPhenotypeTable();
		optionhtml = optionhtml + "<div id='unmatched' style='display:none;'>" + phenohtml + "</div></div>";
		prebl.append(optionhtml);
	    	
	    } else { // no unmatched phenotypes
		var optionhtml = "<div id='unmatchedlabel' style='display:block;'>No Unmatched Phenotypes</div>";
		prebl.append(optionhtml);
	    }
	    
	    $('#matches :checkbox').click(function() {
	        var $this = $(this);
	        // $this will contain a reference to the checkbox   
	        if ($this.is(':checked')) {
	            // the checkbox was checked 
	            $("#unmatched").show();
	        } else {
	            // the checkbox was unchecked
	            $("#unmatched").hide();
	        }
	    });
	},
	

	_buildUnmatchedPhenotypeTable: function(){
	    var self=this;
	    
	    var outer1 = "<table id='phentable'>",
		outer2 = "</table>",
		inner = "";
	    
	    var unmatched = self.state.unmatchedPhenotypes,
	    	labels = self.state.phenotypeLabels,
	    	text = "";
	    var i=0;
	    while( i < unmatched.length) {
	    	inner += "<tr>"; text = "";
	    	for (var j = 0; j < 4; j++){
		    var label = unmatched[i].label;
		    var id = self._getConceptId(unmatched[i++].id);
		    var url_origin = self.document[0].location.origin;
		    text += "<td><a href='" + url_origin + "/phenotype/" + id + "' target='_blank'>" + label + "</a></td>";
		    if (i == unmatched.length) break;
	    	}
	    	inner += text + "</tr>";
	    }
	    return outer1 + inner + outer2;		
	},

	_matchedClick: function(checkboxEl) {
	    if (checkboxEl.checked) {
		// Do something special
		$("#unmatched").show();
	    } else {
		// Do something else
		$("#unmatched").hide();
	    }
	},

	_rectClick: function(data) {
	    var retData;
	    this._showThrobber();
	    jQuery.ajax({
		url : this.state.serverURL + "/phenotype/" + data.attributes["ontology_id"].value + ".json",
		async : false,
		dataType : 'json',
		success : function(data) {
		    retData = "<strong>Label:</strong> " + "<a href=\"" + data.url + "\">"  
			+ data.label + "</a><br/><strong>Type:</strong> " + data.category;
		},
		error: function ( xhr, errorType, exception ) { //Triggered if an error communicating with server  
	    	    self._populateDialog(self,"Error", "We are having problems with the server. Please try again soon. Error:" + xhr.status);
		},
	    });
	    this._updateDetailSection(retData, this._getXYPos(data));
	},

	_toProperCase : function (oldstring) {
	    return oldstring.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
	},
	
	
	//given an array of phenotype objects 
	//edit the object array.
	// items are either ontology ids as strings, in which case they are handled as is,
	// or they are objects of the form
	// { "id": <id>, "observed": <obs>} .
	// in that case take id  if  "observed" is "positive"
	_filterPhenotypeResults : function(phenotypelist) {
    	    //this.state.phenotypeData = phenotypelist.slice();
	    var newlist = [];

	    for (var i = 0; i < phenotypelist.length; i++) {
		pheno = phenotypelist[i];
		if (typeof pheno ==='string') {
		    newlist.push(pheno);
		}
		if (pheno.observed==="positive")
		    newlist.push(pheno.id);
	    }   	
    	    return newlist;
	},   
	
	
	//given an array of phenotype objects 
	//Create a new array for only id and label 
	_filterPhenotypeLabels : function(phenotypelist) {
    	    
	    var newlist = [];
	    for (var i = 0; i < phenotypelist.length; i++) {
	    	newlist.push({ "id" : phenotypelist[i].id, "label" : phenotypelist[i].label});
	    }
	    //copy the list of ids and labels to phenotypeLabels array
	    return newlist;

	}
	
    }); //end of widget code
})(jQuery);
