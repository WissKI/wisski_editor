/**
 * $Id: wisskiTinyMCE.js 2010-03-25 16:30:32Z sivipyat $
 *
 * @author Viktor Pyatkovka (2009-10); Martin Scholz (2010-)
 * @copyright Copyright © 2009, WissKI, All rights reserved.
 */
  
(function() {
  //var Event = tinymce.dom.Event, 
  var each = tinymce.each, 
      DOM = tinymce.DOM, 
      dblevel = 4,  // debug level
      suggestCount = 1;
    
  tinymce.create('tinymce.plugins.WissKICore', {
    
    init : function(ed, url) {
      var t = this; // the plugin object
      t.instance_base_url = ed.getParam('wisski_instance_base_url');  // url prefix for creating new instance URIs
      t.use_rdfa = ed.getParam('wisski_use_rdfa');  // if true, insert RDFa attributes into annotation tags
      t.editor = ed;
      t.ontology = Drupal.settings.wisski.editor.ontology;  // the supported classes and properties
      t.vocabularies = Drupal.settings.wisski.editor.vocabularies;  // the authority vocabularies that we can search for instances
      t.current_anno = undefined; // the annotation the cursor currently stands on; must be set to undefined to correctly set it on startup
      t.current_sel_range = null; // the current cursor selection as character range
      t.instantiable_classes = ed.getParam('instantiable_classes'); // classes for which new instances may be created

      t.classes_x_vocabs = [];  // mapping of classes to vocabs
      for (var c in t.ontology.classes) {
        if (-1 < tinymce.inArray(t.instantiable_classes, t.ontology.classes[c].id))
          t.classes_x_vocabs.push({'class' : t.ontology.classes[c]}); 
      }

      if (tinymce.isIE6) {
        alert("IE 6 or older is not supported by WissKI Annotation Tools. Some functionality might not work correctly.");
// currently there are no known bugs with chrome
//      } else if (tinymce.isWebKit) {
//        alert("Currently, Chrome is not supported by WissKI Annotation Tools. Some functionality might not work correctly.");
      }

      // is this effective?
      ed.addCommand('wisskiCoreBrowseEntities', function(ui, val) {
        var ed = tinymce.activeEditor; t = ed.plugins.wisskicore;
        
        var ret = Drupal.settings.wisski.vocab_ctrl.browse();

        if (ret != null) {
          var anno = ret;
          t.setAnnotation(ed, anno, true);
        }
        
      });


      // Register command to delete annotation
      // This either deletes the whole annotation or it
      // shrinks the annotation by removing head or tail according to selection.
      // If the annotation gets deleted, the tags will remain, all classes will be erased
      // and the class wisski_anno_deleted will be set. This hinders the automatic annotation to
      // reannotate this text range
      ed.addCommand('wisskiCoreDeleteAnno', function(ui, val) {
        var t = this, ed = t.editor, sel, anno;
        
        // the affected annotation can be either passed as val parameter
        // or it will be the current annotation
        //t.db.log("delete val", val);
        if (!val) {
          if (t.current_anno == null) {
            // no anno passed and no current anno => nothing to delete
            t.db.warn('no anno');
            return;
          }
          anno = t.current_anno;
          anno_rng = t.getElementRange(ed, t.current_anno);
          sel = t.current_sel_range;

        }
        
        //t.db.log("delete", anno);
        if (val || sel == null || t.compareRanges(sel, anno_rng, "= si fi di")) {
          // easy case: just delete the whole anno
          var tmp = anno.className;
          tmp = tmp.replace(/\bwisski_anno\S*\b/g, ' '); // delete all annotation info
          anno.className = tmp +  ' wisski_anno_deleted';
        } else {
          
          // remember selection so that we can restore it.
          // the browser selection will get destroyed when
          // moving parts of the DOM out of the annotation
          var sel_start = t.current_sel_range[0], sel_end = t.current_sel_range[1];

          // delete only the selected part
          if (t.compareRanges(sel, anno_rng, "o s")) {
            // delete front
            var remainder = sel[1] - anno_rng[0];
            var n = anno.firstChild;
            var p = anno.parentNode;
            var b = anno;

            while (remainder > 0) {
              if (n.textContent.length <= remainder) {
                // case 1: selection is longer than node content
                // => move whole node before anno and proceed with next
                var tmp = n.nextSibling;
                remainder -= n.textContent.length;
                n.parentNode.removeChild(n);
                p.insertBefore(n, b);
                n = tmp;

              } else if (t._isTextNT(n)) {
                // case 2: text node is longer than selection
                // => split text node 
                var tmp = ed.getDoc().createTextNode(n.textContent.substr(0, remainder));
                n.textContent = n.textContent.substr(remainder);
                p.insertBefore(tmp, b);
                remainder = 0;

              } else {
                // case 3: element node is longer than selection
                // => copy node before anno and descend further
                // we will never have to go up, as this would mean that
                // the node is longer than the sel thus case 1 holds
                var tmp = n.cloneNode(false);
                p.insertBefore(tmp, b);
                p = tmp;
                b = null; // null provokes same behavior as appendChild
                n = n.firstChild();
                
              }    
            }

            var sel_rng = ed.dom.createRng();
            if (t.positionRange(sel_rng, null, sel_start, sel_end)) {
              ed.selection.setRng(sel_rng);
            }

          
          } else if (t.compareRanges(sel, anno_rng, "oi f")) {
            // delete front
            var remainder = anno_rng[1] - sel[0];
            var n = anno.childNodes[anno.childNodes.length - 1];  // select last node
            var p = anno.parentNode;
            var b = anno.nextSibling;

            while (remainder > 0) {
              if (n.textContent.length <= remainder) {
                // case 1: selection is longer than node content
                // => move whole node after anno and proceed with previous
                var tmp = n.previousSibling;
                remainder -= n.textContent.length;
                n.parentNode.removeChild(n);
                p.insertBefore(n, b);
                b = n;
                n = tmp;

              } else if (t._isTextNT(n)) {
                // case 2: text node is longer than selection
                // => split text node 
                var tmp = ed.getDoc().createTextNode(n.textContent.substr(n.textContent.length - remainder));
                n.textContent = n.textContent.substr(0, n.textContent.length - remainder);
                p.insertBefore(tmp, b);
                remainder = 0;

              } else {
                // case 3: element node is longer than selection
                // => copy node before anno and descend further
                // we will never have to go up, as this would mean that
                // the node is longer than the sel thus case 1 holds
                var tmp = n.cloneNode(false);
                p.insertBefore(tmp, b);
                p = tmp;
                b = null; // null provokes same behavior as appendChild
                n = n.firstChild();
                
              }
            }
        
            var sel_rng = ed.dom.createRng();
            if (t.positionRange(sel_rng, null, sel_start, sel_end)) {
              ed.selection.setRng(sel_rng);
            }

          }
        }  

      }, t);
      

      // Set/unset approve state. if anno is not given, takes current anno
      ed.addCommand('wisskiCoreToggleApproved', function(ui, anno) {
        var t = ed.plugins.wisskicore;
        if (!anno) {
          anno = t.current_anno;
          if (!anno) {
            t.db.warn('no anno');
            return;
          }
        }
        if (tinymce.activeEditor.dom.hasClass(anno, 'wisski_anno_approved')) {
          tinymce.activeEditor.dom.addClass(anno, 'wisski_anno_proposed');
          tinymce.activeEditor.dom.removeClass(anno, 'wisski_anno_approved');
        } else {
          tinymce.activeEditor.dom.addClass(anno, 'wisski_anno_approved');
          tinymce.activeEditor.dom.removeClass(anno, 'wisski_anno_proposed');
        }
      }, t);


      // Implemetation of onNodeChange event handler
      // set current anno and trigger onAnnoChange and onSelectChange event
      ed.onNodeChange.add(function(ed, cm, n) {
        var t = ed.plugins.wisskicore;
        
        var old_anno = t.current_anno;  // remember to determine, if we should trigger
        var old_sel = t.current_sel_range;

        // get all annotations overlapping with the cursor / the current selection
        var annos = t.getAnnosOverlappingWith(ed, t.convertW3CRange(ed, ed.selection.getRng(true)), true);
        if (ed.selection.isCollapsed()) {
          // no text selected          
          t.current_sel_range = null;
          if (annos.length == 0) {
            // cursor/selection does not overlap with an annotation
            // unset currently selected anno
            t.current_anno = null;
          } else {
            // cursor/selection does overlap with an annotation
            if (annos.length > 1) { 
              t.db.warn('overlapping annotations: ', annos); // should not happen! annotations normally don't overlap
              t.current_anno = annos[0];  // nonetheless set current anno to something
            } else {
              // set current anno if changed
              t.current_anno = annos[0];
            }
          }
        } else {
          t.current_sel_range = t.convertW3CRange(ed, ed.selection.getRng(true));
          // text selected 
          if (annos.length == 0) {
            // cursor/selection does not overlap with an annotation
            // unset current anno
            t.current_anno = null;
          } else {
            // cursor/selection does overlap with one or more annotations
            // set current anno if changed
            t.current_anno = annos[0];
          }
        }

        if (old_anno === undefined || t.current_anno != old_anno) { // old_anno === undefined will only be true at startup
          // trigger event
          t.onAnnoChange.dispatch(ed, cm, t.current_anno, old_anno);
          t.onSelectionAnnoChange.dispatch(ed, cm, t);
        } else if (t.current_sel_range != old_sel) {
          t.onSelectionAnnoChange.dispatch(ed, cm, t);
        }
          
      });

      
      // init events for cursor actions
      t.onAnnoChange = new tinymce.util.Dispatcher(this); // if the cursor moves over or leaves an annotation 
      t.onSelectionAnnoChange = new tinymce.util.Dispatcher(this); // if the size and position of cursor selection changes (will not trigger on mere cursor moves)

      t.onAnnoChange.add(function(ed, cm, current_anno) {
        cm.setDisabled('wisskiCoreToggleApproved', current_anno == null);
        cm.setActive('wisskiCoreToggleApproved', (!current_anno) ? false : ed.dom.hasClass(current_anno, 'wisski_anno_approved'));
      });
      
      ed.addButton('wisskiCoreBrowseEntities', {
        cmd : 'wisskiCoreBrowseEntities',
        title : 'Browse entities',
        image : url + '/img/browse.png'
      });

      ed.addButton('wisskiCoreToggleApproved', {
        cmd : 'wisskiCoreToggleApproved',
        title : '(Un)set approved',
        image : url + '/img/approved.png',
      });

      t.onAnnoChange.add(function(ed, cm, current_anno) {
        cm.setDisabled('wisskiCoreDeleteAnno', current_anno == null);
      });
 
 
      ed.addButton('wisskiCoreDeleteAnno', {
        cmd : 'wisskiCoreDeleteAnno',
        title : 'Delete Annotation',
        image : url + '/img/delete.png'
      });

      t.onDeleteAnno = new tinymce.util.Dispatcher(this);
      t.onApproveAnno = new tinymce.util.Dispatcher(this);
      t.onProcessSelection = new tinymce.util.Dispatcher(this);
      
/*      ed.onInit.add(function(ed,e){
        t.setTooltip(ed);
      });

      ed.onKeyUp.add(function(ed,e){
        if(e.keyCode == 13)
          t.setTooltip(ed);    
      });*/
    },

    /* Set tooltip to all spans in editor, please leave it as backup ... if new tooltip is ready, then it can be deleted */
    setTooltip : function(ed){

      var spans = ed.contentDocument.getElementsByTagName('span');
      if(spans == undefined || spans == null) return;

      for(var i=0; i<spans.length; i++)
        if(spans[i].className.match('wisski_anno'))
          $(spans[i]).ttip_set();
          //this.setTooltipToElement(spans[i]);

      var tds = $('.mceText');
      if(tds == undefined || tds == null) return;

    },


    
    // computes the Allen relation between two spans
    compareRanges : function(r1, r2, vals) {
      var rel;                                                // r1 is ... R2
      if      (r1[0] <  r2[0] && r1[1] <  r2[0]) rel = "<";   // before
      else if (r1[0] <  r2[0] && r1[1] == r2[0]) rel = "m";   // meets
      else if (r1[0] <  r2[0] && r1[1] <  r2[1]) rel = "o";   // overlaps
      else if (r1[0] <  r2[0] && r1[1] == r2[1]) rel = "fi";  // is finished by
      else if (r1[0] <  r2[0] && r1[1] >  r2[1]) rel = "di";  // contains
      else if (r1[0] == r2[0] && r1[1] <  r2[1]) rel = "s";   // starts
      else if (r1[0] == r2[0] && r1[1] == r2[1]) rel = "=";   // equals
      else if (r1[0] == r2[0] && r1[1] >  r2[1]) rel = "si";  // is started by
      else if (r1[0] >  r2[0] && r1[0] >  r2[1]) rel = ">";   // after 
      else if (r1[0] >  r2[0] && r1[0] == r2[1]) rel = "mi";  // is met by
      else if (r1[0] >  r2[0] && r1[1] <  r2[1]) rel = "d";   // is during
      else if (r1[0] >  r2[0] && r1[1] == r2[1]) rel = "f";   // finishes
      else if (r1[0] >  r2[0] && r1[1] >  r2[1]) rel = "oi";  // is overlapped by
      
      if (!vals) return rel;
      return (vals.search(new RegExp('\\b' + rel + '\\b')) == -1) ? false : true;

    },

    
    // extracts property values encoded in class attrib
    getAnnoProperty : function(anno, prop) {
      var r = new RegExp("\\bwisski_anno_" + encodeURIComponent(prop) + "_(\\S+)\\b", "");
      var args = r.exec(anno.className);
      if (args == null) return null;
      args = args[1].split(":");
      for (var i in args) args[i] = decodeURIComponent(args[i]);
      return args;
    },
    

    // extracts the instance URI of the annotation from the class attrib
    getAnnoURI : function(anno) {
      /\bwisski_anno_uri_(\S+)\b/.exec(anno.className);
      return decodeURIComponent(RegExp.$1);
    },


    // extracts the vocabulary the innstance of the annotation belongs to
    getAnnoVocab : function(anno) {
      if (/\bwisski_anno_vocab_(\S+)\b/.exec(anno.className) != null) {
        return decodeURIComponent(RegExp.$1);
      } else {
        return null;
      }
    },


    // extracts the class the innstance of the annotation belongs to
    getAnnoClass : function(anno) {
      /\bwisski_anno_class_(\S+)\b/.exec(anno.className);
      return decodeURIComponent(RegExp.$1);
    },

    
    // returns all annotation tags in the text 
    getAllAnnotations : function(ed, context_node) {
      
      if (!context_node) context_node = ed.getBody();
      return ed.dom.select('.wisski_anno', context_node);

    },


    // create a random level 4 UUID
    // taken from http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript/2117523#2117523
    createUUID4 : function() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
                return v.toString(16);
      });
    },


    // create a new URI for an instance
    createURI : function() {
      
      var uri = this.instance_base_url + this.createUUID4();
      return uri;

    },
    

    /** Insert annotation in DOM
    * @author Martin Scholz
    */
    setAnnotation : function(ed, anno, approved) {
      var t = this;
           
      // settings in anno object override parameter
      if (anno.approved) approved = anno.approved;
      else if (anno.proposed) approved = !anno.proposed;
      
      // position the anno in the text using a DOM Range object
      var rng = ed.dom.createRng();
      if (t.positionRange(rng, null, anno.range[0], anno.range[1])) {
        
        // check if there already exist annotations in the range
        // depending on the approved/proposed status, we either
        // delete the existing annos or abort
        // if the new anno is approved, we always set it
        // if the new anno is not approved we have to further check
        var oldAnnos = t.getAnnosOverlappingWith(ed, anno.range);

        if (!approved) {
          if (oldAnnos.length > 0) return;
          tinymce.each(oldAnnos, function(a) {
            if (ed.hasClass(a, 'wisski_anno_deleted') || ed.hasClass('wisski_anno_approved')) {
              // the annotation may not be set, because it overlaps with a user-approved annotation
              return;
            }
            if (!anno.hasOwnProperty('uri') && a.className.match(/wisski_anno_uri_/)) {
              // the older annotation has a uri, the newer hasn't
              // this is a heuristics saying that an anno with uri is more specific than an anno without => don't change
              // this may occur on proposed annotations that don't come from vocabs but from heuristical annotators
              return;
            }
          });
        }
        
        // new anno will be set
        // delete old annotations first (delete tags!)
        if (oldAnnos.length != 0) {
          for (var i in oldAnnos) {
            ed.dom.remove(oldAnnos[i], true);
          }
          // position anew, as deletion has changed the dom structure
          // => rng offsets are likely to be illegal
          t.positionRange(rng, null, anno.range[0], anno.range[1]);
        }
        
//        var rngt = (tinymce.isIE) ? t._rangeTextContent(rng) : rng.toString(); // text content of range
//        t.db.debug('range length of new annotation: ', rngt.length);
        var content = rng.extractContents();
        if (content) {
          // create class attribs
          var classes = 'wisski_anno';
          classes += ' wisski_anno_class_' + anno['class'];
          classes += ' wisski_anno_' + (approved ? 'approved' : 'proposed');
          if (anno.hasOwnProperty('voc')) classes += ' wisski_anno_vocab_' + encodeURIComponent(anno.voc);
          if (anno.hasOwnProperty('uri')) classes += ' wisski_anno_uri_' + encodeURIComponent(anno.uri);
          if (anno.hasOwnProperty('rel')) {
            for (var rel in anno['rel']) {
              for (var obji in anno['rel'][rel]) {
                classes += ' wisski_anno_rel_' + encodeURIComponent(rel) + ':' + encodeURIComponent(anno['rel'][rel][obji]);
              }
            }
          }
          if (anno.hasOwnProperty('rev')) {
            for (var rev in anno['rev']) {
              for (var obji in anno['rev'][rev]) {
                classes += ' wisski_anno_rev_' + encodeURIComponent(rev) + ':' + encodeURIComponent(anno['rev'][rev][obji]);
              }
            }
          }
          
          var span = ed.dom.create('span', {'class' : classes}, ed.dom.getOuterHTML(content));
          if (t.use_rdfa) {
            ed.dom.setAttrib(span, 'typeof', t.ontology.classes[anno.class].uri);
            if (anno.hasOwnProperty('uri')) ed.dom.setAttrib(span, 'about', anno.uri);
          }
          var divOffset = $('#edit-body_ifr').offset();
          var xPos = divOffset.left+15;
          var yPos = divOffset.top+5;
          $(span).ttip_set();

          t.db.log("anno to be inserted here:", rng);
          rng.insertNode(span);
          t.db.log('Annotation was set successful. Range:['+anno.range[0]+','+anno.range[1]+']');
        } else {t.db.warn('Can\'t extract contents');}
      } else {t.db.warn('Can\'t create range');}
      
    },
    

    // returns a list with annotations overlapping with a text range
    // depending on excludeDeleted, deleted annos (marked with wisski_anno_deleted)
    // will be included or not
    getAnnosOverlappingWith : function(ed, rng, excludeDeleted) {
      var t = this;
      
      var annos = ed.dom.select('.wisski_anno');
      if (!excludeDeleted) {
        tinymce.each(ed.dom.select('.wisski_anno_deleted'), function(a) {
          annos.push(a);
        });
      }
      var overlaps = [];
      for (var i in annos) {
        var arng = t.getElementRange(ed, annos[i]);
        if (arng[1] > rng[0] && arng[0] < rng[1]) overlaps.push(annos[i]);
      }

      t.db.log('this overlaps: ', overlaps);

      return overlaps;
      
    },

    //Get text range from element
    getElementRange : function(ed, e) {
      var t = this, r = ed.dom.createRng();
      r.setStart(ed.getBody(), 0);
      r.setEnd(e, 0);
      var rt = (tinymce.isIE) ? t._rangeTextContent(r) : r.toString();
      var rngs = rt.length;
      t.db.debug("rngstart: ", rngs);
      var rnge = rngs + e.textContent.length;
      t.db.debug("rngend: ", rnge);
      if (rngs == rnge) t.db.log('Range has no content');
      return [rngs, rnge];
    },

    
    /**Convert a W3C Range object to start and end offset in pure text
    */
    convertW3CRange : function(ed, w3cRng) {
      t = this;
      var rng = ed.dom.createRng();
      rng.setStart(ed.getBody(), 0);
      rng.setEnd(w3cRng.startContainer, w3cRng.startOffset);
      var rngtext = (tinymce.isIE) ? t._rangeTextContent(rng) : rng.toString();
      var s = rngtext.length;
      rngtext = (tinymce.isIE) ? t._rangeTextContent(w3cRng) : w3cRng.toString();
      var e = s + rngtext.length;
      return [s, e];
    },



    
    // Mark a sequence of chars as deleted annotation
    // This will prevent the autodetection from setting annotations anew.
    deleteAnnotation : function(ui, anno) {
      var t = this, ed = t.editor;
      var r = t.getRange(ed, e[0]);
      t.db.log('Annotation '+ anno + ' removed');
      anno.className = 'wisski_deleted';
      //if (!tinymce.isIE6) tinyMCE.activeEditor.execCommand('cleanup');
      //Get the old selection from range
      /*var rng = ed.dom.createRng();
      if (t.positionRange(rng, b, r[0], r[1])) {
        t.db.debug('Set selection on range '+r[0]+':'+r[1]);
        ed.selection.setRng(rng);
      } else {t.db.warn('Can not create range');}*/
      t.onDeleteAnno.dispatch();
    },
    
    
    //Get text range from selection or from selected SPAN
    getRange : function(ed, n) {
      var t = this, r = ed.dom.createRng(), plus;
      var e = ed.dom.getParent(n, 'SPAN');
      var b = ed.dom.getParent(n, 'P');
      if (!b) return [0,0];
      t.db.debug('Ready for range');
      r.setStart(b, 0);
      if (e && (t.getElemId(ed, e, 'SPAN') || t.getElemId(ed, e, 'SPAN', '(wisski_deleted)'))) {
        r.setEnd(e, 0);
        var se = ed.dom.getOuterHTML(e);
        se = t.stripHTML(se);
        plus = se.toString().length;
      } else {
        var sr = ed.selection.getRng(tinymce.isIE);
        t.db.debug('Range from selection created');
        r.setEnd(sr.startContainer, sr.startOffset);
        var srt = (tinymce.isIE) ? t._rangeTextContent(sr) : sr.toString();
        plus = srt.length
      }
      var rt = (tinymce.isIE) ? t._rangeTextContent(r) : r.toString();
      var rngs = rt.length;
      t.db.debug("rngstart: ", rngs);
      var rnge = rngs + plus;
      t.db.debug("rngend: ", rnge);
      if (rngs == rnge) t.db.log('Range has no content');
      return [rngs, rnge];
    },
    
    compareRange : function(ed, r, bid) {
      var sr = this.getRange(ed, ed.selection.getNode());
      var sbid = this.getElemId(ed, ed.selection.getNode(), 'P');
      if (sbid != bid) {
        this.db.debug('Blocks are different. Editor:' + sbid + ' Menu:' + bid);
        return false;
      }
      if (!((sr[0] === r[0]) && (sr[1] === r[1])))
        this.db.debug('Ranges are different. Editor:' + sr[0] + ':' + sr[1] + ' Menu:' + r[0] + ':' + r[1]);
      // Compare arrays function      
      return ((sr[0] === r[0]) && (sr[1] === r[1]));
    },
    
    
    // toggle busy state for  requests to server
    setProgressState : function(set) {
      var ed = tinymce.activeEditor;
      if (ed.plugins.wisskiprogress)
        ed.plugins.wisskiprogress.setProgressState(set);
      else
        ed.setProgressState(set);
    },
    
    
    //set cursor positions
    setPosition : function(x, y) {
      this._pos.clientX = x;
      this._pos.clientY = y;
    },
    
    
    /* Debugging and logging functions */
    
    // central debug function
    db : {
      debug : function(a, b, c) {
        b = (b) ? b : '';
        c = (c) ? c : '';
        if ((window.console != undefined) && (dblevel == 5)) window.console.log(a, b, c);
      },
      log : function(a, b, c) {
        b = (b) ? b : '';
        c = (c) ? c : '';
        if ((window.console != undefined) && (dblevel >= 4)) window.console.log(a, b, c);
      },
      warn : function(a, b, c) {
        b = (b) ? b : '';
        c = (c) ? c : '';
        if ((window.console != undefined) && (dblevel >= 3)) window.console.warn(a, b, c);
      },
      info : function(a, b, c) {
        b = (b) ? b : '';
        c = (c) ? c : '';
        if ((window.console != undefined) && (dblevel >= 2)) window.console.info(a, b, c);
      },
      error : function(a, b, c) {
        b = (b) ? b : '';
        c = (c) ? c : '';
        if ((window.console != undefined) && (dblevel >= 1)) window.console.error(a, b, c);
      },
      dir : function(a, b, c) {
        b = (b) ? b : '';
        c = (c) ? c : '';
        if ((window.console != undefined) && (dblevel > 0)) window.console.dir(a, b, c);
      }
    },
    
    /** 
    * Sets the start and end attribs of range so that
    * it encloses the plain text demarked by start and end.
    * context is the node that contains the text. (eg. <p>)
    * Returns true if both range bounds were set.
    */
    positionRange : function(range, context, start, end) {
      var t = this, text_length = 0;
      
      // edit this to print debug output
      var dbg = ((window.console != undefined) && (dblevel == 5));

      if (context == undefined || context === null) {
        context = t.editor.getBody();
      }

      //if (dbg) t._printDOMTree(context);
        
      if (dbg) t.db.log("start positionRange");
      if (dbg) t.db.log(context);
      if (dbg) t.db.log(context.nodeType);
      
      // easy case: search in one text node
      if (t._isTextNT(context)) {
        if (start <= context.nodeValue.length && end <= context.nodeValue.length) {
          range.setStart(context, start);
          range.setEnd(context, end);
          return true;
        } else {
          return false; // out of bounds
        }
      }

      if (context.firstChild === null) {  // empty context node
        return false;
      }

      var p = context;
      var up = false;
      var last_textnode = null;
      
      // go through the subtree of context depth-first left-to-right
      // and gather the text till it reached start
      var count = 0;
      do {
        count++;
        if (up) {
          if (p) {
            p = p.parentNode;
            if (p && (p.nextSibling !== null)) {
              p = p.nextSibling;
              up = false;
            }
          } else {
            // how that!?
            t.db.log("unexpected error: got null as parent node!");
            return false;
          }
        } else {
          if (t._isTextNT(p)) {
            last_textnode = null;
            text_length += p.nodeValue.length;
            if (text_length > start) { // bugfix: insert '=' to properly cope with cursors at end of text! Martin: reset! done after loop (see there)
              // start is reached! reset range position
              range.setStart(p, start - text_length + p.nodeValue.length);
              
              // catch easy case where start and end are in the same text node.
              if (text_length >= end) {
                if (dbg) t.db.log("range in one TextNode");
                range.setEnd(p, end - text_length + p.nodeValue.length);
                return true;
              }
              
              break;
            } else if (text_length == start) {
              last_textnode = p;
            }
          }
          if (p.firstChild !== null) {
            p = p.firstChild;
          } else if (p.nextSibling !== null) {
            p = p.nextSibling;
          } else {
            up = true;
          }
        }

        if (dbg) t.db.log("up: ", (up) ? "true":"false");
        if (dbg) t.db.log(p);
        if (dbg) t.db.log("text: ", text);
/* a loop should be practically impossible
        if (count == 30000) {
          // likely to be in a loop
          t.db.warn("oh!oh! loop at start!?");
          return false;
        }*/

      } while (p !== context);
        
      if (dbg) t.db.log("break ");
      if (dbg) t.db.log("count: ", count);
      if (dbg) t.db.log("up: ", (up) ? "true":"false");
      if (dbg) t.db.log(p);
      if (dbg) t.db.log("text: ", text);
      

      // Martin: cope with cursor at end of text
      // start and end must be equal (collapsed)
      // last_textnode will only be set if
      // start == text_length for last textnode in DOM fragment
      if (last_textnode && start == end) {
        range.setStart(last_textnode, last_textnode.textContent.length);
        range.setEnd(last_textnode, last_textnode.textContent.length);
        return true;
      }


      // text in context is not long enough
      if (p === context) {
        if (dbg) t.db.log("text in context is not long enough");
        return false;
      }

        
      if (p.nextSibling !== null) {
        p = p.nextSibling;
        up = false;
      } else {
        up = true;
      }
      
      // continue tree traversal till end is reached
      count = 0;
      do {
        count++;
        if (up) {
          if (p) {
            p = p.parentNode;
            if (p && (p.nextSibling !== null)) {
              p = p.nextSibling;
              up = false;
            }
          }
        } else {
          if (t._isTextNT(p)) {
            text_length += p.nodeValue.length;
            if (text_length >= end) {
              range.setEnd(p, end - text_length + p.nodeValue.length);
              if (dbg) t.db.log("rng: ", range);
              return true;
            }
            if (p.firstChild !== null) {
              p = p.firstChild;
            } else if (p.nextSibling !== null) {
              p = p.nextSibling;
            } else {
              up = true;
            }
          } else {
            if (p.firstChild !== null) {
              p = p.firstChild;
            } else if (p.nextSibling !== null) {
              p = p.nextSibling;
            } else {
              up = true;
            }
          }
        }
        /* a loop should be practically impossible
        if (count == 30000) {
          // likely to be in a loop
          t.db.warn("oh!oh! loop at start!?");
          return false;
        }*/
      } while (p !== context);
      if (dbg) t.db.log("count: ", count);

      return true;
      
    },
    
    
    /**
    *  Returns the plain text in a DOM range.
    * @depricated
    */
    _rangeTextContent : function(range) {
      if (range.collapsed) { return ""; }
      if (!tinymce.isIE) return range.toString();
      var t = this
      var p = range.startContainer;
      var e = range.endContainer;

      var text = "";
      var suffix = "";
      var i;
      var up = false;

      // reposition the start node according to the offset
      // to be the first node that starts in the range
      if (t._isTextNT(p)) {
      // text node
      if (p == e) { // start and end node are the same => we're done
        return p.nodeValue.substring(range.startOffset, range.endOffset);
      } else { //  get text and move one node to the right
        text = p.nodeValue.substring(range.startOffset);
        if (p.nextSibling === null) {
        up = true;
        } else {
        p = p.nextSibling;
        }
      }
      } else {
      // select the child node at offset for start
      p = p.firstChild;
      for (i = range.startOffset; i > 0; i--) {
        if (p === null) return ""; // this should not occur!
        p = p.nextSibling;
      }
      }
      
      // reposition end node according to offset
      // to be the first node that is no longer in the range
      // when traversing from left to right
      if (t._isTextNT(e)) {
      // text node => tmp store text clip (suffix)
      // and treat this node as if right outer bound of range
      suffix = e.nodeValue.substring(0, range.endOffset);
      } else {
      e = e.firstChild;
      for (i = range.endOffset; i > 0; i--) {
        if (e === null) return ""; // this should not occur!
        e = e.nextSibling;
      }
      }

      // do a depth-first "left-to-right" tree traversal
      // start at p, stop when e is reached
      // p is assumed left of e (no negative range!)
      while (p != e) {
      if (up) {
        if (p) {
          p = p.parentNode;
          if (p && (p.nextSibling !== null)) {
          p = p.nextSibling;
          up = false;
          }
        }
      } else {
        if (t._isTextNT(p)) {
        // text is always a leaf; add text
        text += p.nodeValue;
        if (p.nextSibling !== null) {
          p = p.nextSibling;
        } else {
          up = true;
        }
        } else {
        if (p.firstChild !== null) {
          p = p.firstChild;
        } else if (p.nextSibling !== null) {
          p = p.nextSibling;
        } else {
          up = true;
        }
        }
      }
      }

      return text + suffix;
    },
    
    //returns true if the node is a text node
    _isTextNT : function(node) {
      return ($.browser.msie) ? (node.nodeType === 3 || node.nodeType === 4) : (node.nodeType === node.TEXT_NODE || node.nodeType === node.CDATA_SECTION_NODE);
    },
    
    _isObject : function(obj) {
      return (obj.constructor.toString().indexOf("Object") == -1) ? false : true;
    },
    
    //strip html tags 
    stripHTML : function(html) {
       var tmp = document.createElement("DIV");
       tmp.innerHTML = html;
       return this.getTextContent(tmp);
    },
    
    // get the text contents of an element
    getTextContent : function(e) {
      if (e.textContent && (e.textContent != ''))
        return e.textContent;
      else if (e.innerText && (e.innerText != ''))
        return e.innerText;
      else
        return '';
    },

    // get the text contents of a range
    getTextOfRange : function(ed, start, end) {
      var t = this;

      var rng = ed.dom.createRng();
      t.positionRange(rng, null, start, end);
      return rng.toString();

    },
    
    
    getInfo : function() {
      return {
        longname : 'WissKI Core',
        author : 'Viktor Pyatkovka, Martin Scholz, Eugen Meissner'
      };
    }
    
  });
  
  // Register plugin
  tinymce.PluginManager.add('wisskicore', tinymce.plugins.WissKICore);  
})();
