/**
 *
 * @ author: Eugen Meissner, changes by Martin Scholz
 * @ contact: eugen.meissner@ymail.com
 * (c) WissKI Project http://wiss-ki.eu
 *
 */

(function() {
  
  // Set up functions and vars in global namespace
  if (typeof WissKI === 'undefined') WissKI = {};
  if (typeof WissKI.editor === 'undefined') WissKI.editor = {};
  if (typeof WissKI.editor.tooltips === 'undefined') WissKI.editor.tooltips = {};
  

  /** here we cache all visible tooltips so that they can be directly accessed and hidden
  */
  WissKI.editor.tooltips.shown = [],
      

  /** hides all currently visible tooltips
  */
  WissKI.editor.tooltips.hideAll = function() {
    for (var i in WissKI.editor.tooltips.shown) {
      $(WissKI.editor.tooltips.shown[i]).qtip("hide");
    }
  },


  /** Init an infobox for one element, retrieve the metadata
  */
  WissKI.editor.tooltips.setElement = function(elem) {
  
    // either jQuery or the qTip tooltip plugin are not loaded
    // just quietly quit, so that we do not produce an error
    if (typeof jQuery === 'undefined' ||
        typeof jQuery.fn.qtip === 'undefined') return;

  
    var className = elem.className;

    /* position of tooltip must be calculated if an editor is available */
    var xPos = 0;
    var yPos = 0;
    var divOffset = $('#wki-content').offset();
    var ifr = $('#edit-body_ifr');
    var target = false;

    if ($('.mceEditor').length != 0) target = $('.mceEditor');

    if(ifr.length!=0 && !className.match('mceText')){
      xPos = divOffset.left+15;
      yPos = divOffset.top+70;
    }

    if(className.match('mceText'))
      className = elem.parentNode.parentNode.className;

    /* set label which will be displayed under info */
    var classLabel = WissKI.editor.tooltips.getAnnoClassLabel(className);

    $(elem).qtip({
      content : {
        title : '<div id="ttip_title"><h1>Info</h1><h2>'+classLabel+'</h2></div>',
        text  : 'Please wait'
      },
      position : {
        target : target,
        corner : {
          tooltip : 'leftTop',
          target  : 'rightTop'
        },
        adjust : {
          x : 0, //xPos,
          y : 0, //yPos,
          resize: true
        }
      },
      style : {
        border : {
          width   : 3,
          radius  : 3
        },
        width:375,
        padding : 5,
        tip : true,
        name  : 'light', 
      },
      api : {
        onRender : function() {
          
          var span = this.elements.target[0];
          if (span == null) {
            this.updateContent('Please try again later ...');
            return;
          }
          
          var className = span.className;
          
          if(className.match('mceText'))
            className = span.parentNode.parentNode.className;

          if(className.match('wisski_anno_new')){
            WissKI.editor.tooltips.getContentForNewElem(className,this);
          }else{
            var uri = WissKI.editor.tooltips.getDecodedAnnoURI(className);
            WissKI.editor.tooltips.doRequest(uri,this);
          } 
        },
        // Martin:  problem: when annotation is selected in menu, tooltip stays forever as
        // the menu element is destroyed and no mouseout event is triggered
        // use this as workaround: keep a list of shown tooltips, and destroy them on time.
        onShow : function() {
          WissKI.editor.tooltips.shown.push(elem);
        },
        onHide : function() {
          for (var i in WissKI.editor.tooltips.shown) {
            if (WissKI.editor.tooltips.shown[i] == elem) {
              WissKI.editor.tooltips.shown.splice(i, 1);
              break;
            }
          }
        }
      },
      show : {
        solo : true,

      },
      hide : {
        when:'mouseout',
        delay:200,
        fixed:true
      }
    });
  }
    
  /** Displays a text for newly created instances where no data is available
  */
  WissKI.editor.tooltips.getContentForNewElem = function(className,ttip) {
    var ttipContent =  'Create a new ' + WissKI.editor.tooltips.getAnnoClassLabel(className);
        ttip.updateContent(ttipContent);
  }
  
  /** Retrieves metadata/fields from server
  */
  WissKI.editor.tooltips.doRequest = function(uri, tooltip, vid) {
    $.ajax({
      url : Drupal.settings.wisski.editor.about_url,
      content_type : "application/json",
      type : "POST",
      data : 'wisski_editor_query=' + '{"uri":"'+uri+ '","fields":"all broader_labels"}',
      timeout : 4000,
      success : function (response) {
        var json = Drupal.parseJson(response);
        if (json.length==0) {
          tooltip.updateContent('No information available at the moment.');
          return;
        }
        var tooltipContent = WissKI.editor.tooltips.getContent(json);
        tooltip.updateContent(tooltipContent);
      }
    });
  }


  /** Builds the inner infobox with its key value table and optionally includes the map
  */
  WissKI.editor.tooltips.getContent = function(json) {
    for (var i in json) {
      var annoObject = json[i];
      var vocabID = i;
      for (var j in annoObject){ 
        var annoURI = j;
        var annoChild = annoObject[j];
        if (!annoChild.label || annoChild.label.length == 0) continue;
        var annoLabel = annoChild.label[0].value;
        
        if (annoChild.latitude && annoChild.longitude) {
          var coords = {lat : annoChild.latitude[0].value, lng : annoChild.longitude[0].value};
        }

        if (annoChild.broader) {
          var annoBroader = annoChild.broader[0].value;
        }

        if (annoChild.broader_labels) {
          var broaderLabels = annoChild.broader_labels;
        }

        if (annoChild.image) {
          var image = annoChild.image[0].value;
        }

      }
    }
    
    var tooltipContent  = '<table id="ttip_content">'
                      + '<tr>'
                      + '<td>'
                      + '<table>'
                      + '<tr><td>Name:</td><td>'+annoLabel+'</td></tr>';
    if (broaderLabels) tooltipContent += '<tr><td>Broader:</td><td>' + WissKI.editor.tooltips.prettyPrintBroaderLabels(broaderLabels) + '</td></tr>';
    tooltipContent += '<tr><td>URI:</td><td><a href="' + annoURI + '" target="_blank">' + annoURI + '</a></td></tr>';
    tooltipContent += '<tr><td>Catalog:</td><td>' + WissKI.editor.tooltips.getAnnoVocabLabel(vocabID) + '</td></tr>';
    if(coords != undefined || coords != null){
      tooltipContent += '<tr><td>Long:</td><td>' + coords.lng + '</td></tr>'
                     + '<tr><td>Lat:</td><td>' + coords.lat + '</td></tr>';
      tooltipContent += '</table>'
                     + '</td>'
                     + '<td><div style="width:125px;height:125px;">' + WissKI.editor.tooltips.getMap(coords) + '</div></td>';
    } else {
      tooltipContent += '</table></td>';
    }
    if (image != undefined || image != null) {
      tooltipContent += '<td><div style="width:125px;height:125px;"><img style="width:125px;height:auto;" src="' + image + '"/></div></td>';
    }
    tooltipContent += '</tr>';

    tooltipContent += '</table>';

    return tooltipContent;
  }

  
  /** Pretty print the list of broader term labels
  */
  WissKI.editor.tooltips.prettyPrintBroaderLabels = function(broaderLabels) {
    var broader = '';
    var broaders = 0;
    for(var i in broaderLabels ){
      broaders++;
    }
    var broader = broaderLabels[0];
    for(var i=1; i<broaders; i++){
      broader += ' | ' + broaderLabels[i];
    }
    return broader;
  }
  

  /** Include the google map image and set it to the coordinates
  */
  WissKI.editor.tooltips.getMap = function(coords){
    /* check coords format, we need decimal */
    if (coords.lat.match(/[NSWE]/) || coords.lng.match(/[NSWE]/)) {
      coords = WissKI.editor.tooltips.parseDMSD(coords);
    } else if (coords.lat.match(/°|\d[°'`´ ]+\d/)) {
      coords = WissKI.editor.tooltips.parseDMSminus(coords);
    }

    /* settings for maps */
    var zoomlvl = 'zoom=8';
    var size = '&size=125x125';
    var maptype = '&maptype=roadmap';
    var marker = '&markers=color:red|label:A|'+coords.lat+','+coords.lng;
    var googleMaps = 'http://maps.google.com/maps/api/staticmap?';
    var googleMapsLink = 'http://maps.google.com/?';
    var loc = 'q=loc:'+coords.lat+','+coords.lng;
    var query = googleMaps+zoomlvl+size+maptype+marker+'&sensor=false';
    var linkQuery = googleMapsLink + loc + '&z=8';
    var map = '<a target="_blank" href="' + linkQuery + '"><img src="'+query+'" style="padding-right:5px;"></a>';
    return map;
  }

  
  /**
   * This method gets a string and search for wisski_anno_class_ID, extracts the ID and looks up the label.
   * If label exisits label will be returned otherweise 'undefined'
   *
   * @author Eugen Meissner
   * @param class names
   **/
  WissKI.editor.tooltips.getAnnoClassLabel = function(className) {
    
    var annoClass = '<none>';
    var annoClassRegEx = /wisski_anno_class_(\w*)/;
    var annoClassID = annoClassRegEx.exec(className);
    if (annoClassID == null) return annoClass;
    annoClassID = decodeURIComponent(annoClassID[1]);
    var ontology = Drupal.settings.wisski.editor.ontology; 
    for (var i in ontology.classes) {
      if (ontology.classes[i].id == annoClassID) {
        annoClass = ontology.classes[i].label;
        break;
      }
    }
    return annoClass;
  }

  
  /*
   * Same as above, only for wisski_anno_uri_URI.
   *
   * @author Eugen Meissner, Martin Scholz
   * @return decoded URI
   **/
  WissKI.editor.tooltips.getDecodedAnnoURI = function(className) {
    
    var annoUriRegEx = /wisski_anno_uri_(\S*)/;
    var annoURIA = annoUriRegEx.exec(className);
    var annoURI = decodeURIComponent(annoURIA[1]);

    return annoURI;
  }

  /*
   * Same as above, only for wisski_anno_vocab_ID
   *
   * @author Eugen Meissner, Martin Scholz
   * @return label of Vocabulary
   **/
  WissKI.editor.tooltips.getAnnoVocabLabel = function(vocabID) {
    
    var label = '<none>';
    if (!vocabID) {
    } else {
      var vocab = Drupal.settings.wisski.editor.vocabularies;
      for (var i in vocab) {

        if (vocabID == vocab[i].vid) {
          label = vocab[i].name;
          break;
        }
      }
    }

    return label;
  }


  /** taken from http://stackoverflow.com/questions/1140189/converting-latitude-and-longitude-to-decimal-values
  */
  WissKI.editor.tooltips.parseDMSminus = function(coords) {
    var lat_parts = coords.lat.split(/[^-\d\.]+/);
    var lng_parts = coords.lng.split(/[^-\d\.]+/);
    
    /* fill values if not present */
    if (lat_parts.length == 1) lat_parts[1] = 0;
    if (lat_parts.length == 2) lat_parts[2] = 0;
    if (lng_parts.length == 1) lng_parts[1] = 0;
    if (lng_parts.length == 2) lng_parts[2] = 0;

    /* convert */
    var lat = WissKI.editor.tooltips.convertDMSToDD(lat_parts[0], lat_parts[1], lat_parts[2], 'N');
    var lng = WissKI.editor.tooltips.convertDMSToDD(lng_parts[0], lng_parts[1], lng_parts[2], 'E');
    return {lat : lat, lng : lng};
  }

  /** taken from http://stackoverflow.com/questions/1140189/converting-latitude-and-longitude-to-decimal-values
  */
  WissKI.editor.tooltips.parseDMSD = function(coords) {
    var lat_parts = coords.lat.split(/[^\d\w\.]+/);
    var lng_parts = coords.lng.split(/[^\d\w\.]+/);
    
    /* fill values if not present */
    if (lat_parts.length == 1) lat_parts[1] = 0;
    if (lat_parts.length == 2) lat_parts[2] = 0;
    if (lat_parts.length == 3) lat_parts[3] = 'N';
    if (lng_parts.length == 1) lng_parts[1] = 0;
    if (lng_parts.length == 2) lng_parts[2] = 0;
    if (lng_parts.length == 3) lng_parts[3] = 'E';
    
    /* convert */
    var lat = WissKI.editor.tooltips.convertDMSToDD(lat_parts[0], lat_parts[1], lat_parts[2], lat_parts[3]);
    var lng = WissKI.editor.tooltips.convertDMSToDD(lng_parts[0], lng_parts[1], lng_parts[2], lng_parts[3]);
    return {lat : lat, lng : lng};
  }

  /** taken from http://stackoverflow.com/questions/1140189/converting-latitude-and-longitude-to-decimal-values
  */
  WissKI.editor.tooltips.convertDMSToDD = function(days, minutes, seconds, direction) {
    days = parseFloat(days);
    minutes = parseFloat(minutes);
    seconds = parseFloat(seconds);
    var dd = Math.abs(days) + minutes/60 + seconds/(3600);
    dd = parseFloat(dd);
    if (direction == "S" || direction == "W" || days < 0) {
      dd = dd * -1;
    } // Don't do anything for N or E
    return dd;
  }


  /** Declare a new jquery function that attaches an infobox to one or more DOM elements
  */
  $.fn.ttip_set = function() {
    for(var i=0; i<this.length; i++){
      WissKI.editor.tooltips.setElement(this[i]);
    }
  }


  $().ready(function() {
    
    // augment links in the structured data form so that vocab info box can be displayed
    if (Drupal.settings.wisski.editor.showTooltipsForForm) {
      $('.wki-data-value a').each(function() {
        $(this).addClass('wisski_anno');
        $(this).addClass('wisski_anno_uri_' + encodeURIComponent($(this).attr('href')));
      });
    }

    // attach a infobox to each annotation in the DOM tree
    $('.wisski_anno').ttip_set();
  });

})();
