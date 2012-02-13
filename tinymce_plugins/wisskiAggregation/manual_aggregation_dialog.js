

tinyMCEPopup.onInit.add(function(ed) {
  
  var w = {
    
    // some options from the editor
    t : tinyMCEPopup.params['t'], // the wisskiAggregate plugin object
    editor : ed,
    properties : tinyMCEPopup.params['properties'], // the properties that have the class of the selected anno as range or domain
    anno : tinyMCEPopup.params['anno'], // the selected anno
    anno_class : tinyMCEPopup.params['anno_class'], // the class of the selected anno
    annos : tinyMCEPopup.params['annos'], // all annos
    eventUtil : new tinymce.dom.EventUtils(),
    counter : 0,  // generic counter for ids etc.
    
    // shortcuts to html elements
    relThis : document.getElementById('addRelThis'),
    relRel : document.getElementById('addRelRelation'),
    relObj : document.getElementById('addRelObject'),
    relAdd : document.getElementById('addRelAdd'),
    // the rev* fields are currently not displayed!
    revThis : document.getElementById('addRevThis'),
    revRel : document.getElementById('addRevRelation'),
    revSub : document.getElementById('addRevSubject'),
    revAdd : document.getElementById('addRevAdd'),
    tblThis : document.getElementById('existingRelsThis'),
    tblOthers : document.getElementById('existingRelsOthers'),

    
    /* functions */

    // get the part of class attrib of anno that contains all classes starting with wisski_anno 
    // the classes in the string are not decoded ie. as-is
    getAnnoClasses : function(anno) {
      var str = ' ', c;
      var re = new RegExp('\\bwisski_anno\\S*\\b', 'g');
      while (c = re.exec(anno.className)) {
        str += c + ' ';
      }

      return str;
    },

    // get the uri of anno
    getAnnoURI : function(anno) {
      /\bwisski_anno_uri_(\S+)\b/.exec(anno.className);
      return decodeURIComponent(RegExp.$1);
    },
    
    
    // fill the relations select field
    // the field must be given in selobj
    // depending on forDomain, the field will be filled with
    // properties that for the annotation class as either domain (forDomain==true) or range.
    fillAvailableRelations : function(w, selobj, forDomain) {
      selobj.options.length = 0;
      var already_set = [];
      tinymce.each(w.properties[forDomain ? 'by_domain' : 'by_range'], function(pl) {
        tinymce.each(pl, function(p) {
          if (tinymce.inArray(already_set, p.id) != -1) return;
          already_set.push(p.id);
          var title = p.label + ' (' + p.range.join(', ') + ')';
          ed.dom.add(selobj, 'option', {title : title, 'value' : encodeURIComponent(p.id) }, ed.dom.encode(p.label));
        });
      });
    },

    
    // fill the annos select field
    fillAvailableAnnos : function(w, relobj, selobj, addobj, forDomain) {
      var prop;
      
      if (relobj.selectedIndex < 0 || relobj.options[relobj.selectedIndex].value === '') {
        prop == null;
      } else {
        prop = w.properties.by_id[relobj.options[relobj.selectedIndex].value];
      }

      selobj.options.length = 0; // delete select list
  
      if (prop == null) {
        ed.dom.setAttrib(selobj, 'disabled', 'disabled');
      } else {
        ed.dom.setAttrib(selobj, 'disabled', null);
        var classes = forDomain ? [prop.domain] : prop.range;
        tinymce.each(classes, function(c) {
          if (w.annos.hasOwnProperty(c)) {
            tinymce.each(w.annos[c], function(a) {
                ed.dom.add(selobj, 'option', {'value' : encodeURIComponent(w.getAnnoURI(a)), 'class' : w.getAnnoClasses(a)}, a.textContent);
            });
          }
        });
        ed.dom.setAttrib(addobj, 'disabled', selobj.options.length == 0 ? 'disbled' : null);
      }

    },
    

    // quote regex special chars
    regexQuote : function (str) {
      return str.replace(/([.?*+^$[\]\\(){}-])/g, "\\$1");
    },

    
    // fill the tables with set relations
    // there are 2 tables: one for relations set on this annotation (tblThis)
    // an one for relations set on other annotations (tblOthers)
    fillExistingRelationsAll : function(w) {
      
      // clear tables
      while (w.tblThis.childNodes.length != 0) {
        w.editor.dom.remove(w.tblThis.childNodes[0], false);
      }
      tinymce.walk(w.tblOthers.childNodes, function(n) { w.editor.dom.remove(n, false); });
      
      // renew tables
      w.fillExistingRelations(w, w.tblThis, w.anno, null);
      for (var i in w.annos) {
        for (var j in w.annos[i]) {
          if (w.annos[i][j] != w.anno) {
            w.fillExistingRelations(w, w.tblOthers, w.annos[i][j], w.anno);
          }
        }
      }

    },

    
    // fills a table with existing relations
    fillExistingRelations : function(w, table, anno, range_anno) {
      
      var range_anno_uri_enc; 
      if (!range_anno) {
        range_anno_uri_enc = '\\S+';
      } else {
        /\bwisski_anno_uri_(\S+)\b/.exec(range_anno.className);
        range_anno_uri_enc = w.regexQuote(RegExp.$1);
      }

      var rels = {};
      var r;
      var regex = new RegExp('\\bwisski_anno_rel_(\\S+):(' + range_anno_uri_enc + ')\\b', 'g');
      while (r = regex.exec(anno.className)) {
        if (!rels[r[1]]) rels[r[1]] = [];
        rels[r[1]].push(r[2]);
      }

      for (var prop_id_enc in rels) {
        for (var i in rels[prop_id_enc]) {
          var range_anno_uri_enc = rels[prop_id_enc][i];
          var prop = w.properties.by_id[decodeURIComponent(prop_id_enc)];
        
          if (!prop) {  // dead link: property does not exist
            w.editor.dom.removeClass(anno, 'wisski_anno_rel_' + prop_id_enc + ':' + range_anno_uri_enc);
            return;
          }
          
          if (range_anno) {
            w.addExistingRelation(w, table, anno, prop, range_anno);
          } else {
            var regex = new RegExp("\\bwisski_anno_uri_" + w.regexQuote(range_anno_uri_enc) + "\\b");
            var found = false;
            tinymce.each(prop.range, function(r) {
              tinymce.each(w.annos[r], function (a) {
                if (!found && regex.test(a.className)) {
                  w.addExistingRelation(w, table, anno, prop, a);
                  found = true;
                }
              });
            });
            if (!found) { // dead link: entity does not exist
              w.editor.dom.removeClass(anno, 'wisski_anno_rel_' + prop_id_enc + ':' + uri_enc);
            }
          }
        }
      }

    },

    
    // add a table row for a relation
    addExistingRelation : function(w, table, subj_anno, prop, obj_anno) {
      
      var id = "relDel_" + ++w.counter;
      
//      var html = '<td width="30%"><span class="' + w.getAnnoClasses(subj_anno) + '">' + subj_anno.textContent + '</span></td>';
//      html += '<td width="30%">' + prop.label + '</td>';
//      html += '<td width="30%"><span class="' + w.getAnnoClasses(obj_anno) + '">' + obj_anno.textContent + '</span></td>';
//      html += '<td width="10%"><input type="button" id="' + id + '" value="Delete"/></td>';
//      w.editor.dom.add(table, 'tr', {}, html);

      var tr = document.createElement('tr'), td, inner;
      
      // subj_anno
      td = document.createElement('td');
      inner = document.createElement('span');
      inner.textContent = subj_anno.textContent;
      inner.className += w.getAnnoClasses(subj_anno);
      td.appendChild(inner);
      tr.appendChild(td);
      // property
      td = document.createElement('td');
      inner = document.createElement('span');
      inner.textContent = prop.label;
      td.appendChild(inner);
      tr.appendChild(td);
      // obj_anno
      td = document.createElement('td');
      inner = document.createElement('span');
      inner.textContent = obj_anno.textContent;
      inner.className += w.getAnnoClasses(obj_anno);
      td.appendChild(inner);
      tr.appendChild(td);
      // delete button
      td = document.createElement('td');
      inner = document.createElement('input');
      w.editor.dom.setAttrib(inner, 'id', id);
      w.editor.dom.setAttrib(inner, 'type', 'button');
      w.editor.dom.setAttrib(inner, 'value', 'Delete');
      td.appendChild(inner);
      tr.appendChild(td);

      table.appendChild(tr);

      w.eventUtil.add(document.getElementById(id), 'click', function() {
        w.editor.dom.removeClass(subj_anno, 'wisski_anno_rel_' + encodeURIComponent(prop.id) + ':' + encodeURIComponent(w.getAnnoURI(obj_anno)));
        w.fillExistingRelationsAll(w);
      });
        
    },

    
    // adds a relation to the annotation
    // executed by the add buttons
    addRelationToAnno : function(w, subj_anno, prop_id_enc, obj_anno_uri_enc) {
      w.editor.dom.addClass(subj_anno, 'wisski_anno_rel_' + prop_id_enc + ':' + obj_anno_uri_enc);
    }


  };
  
  // executed only on init
  
  // listener for updating annotation select field
  w.eventUtil.add(w.relRel, 'change', function() {
    w.fillAvailableAnnos(w, w.relRel, w.relObj, w.relAdd, false);
  });
/*  w.eventUtil.add(w.revRel, 'change', function() {
    w.fillAvailableAnnos(w, w.revRel, w.revSub, w.revAdd, true);
  });*/
  
  // listener for adding relations
  w.eventUtil.add(w.relAdd, 'click', function() {
    w.addRelationToAnno(w, w.anno, w.relRel.options[w.relRel.selectedIndex].value, w.relObj.options[w.relObj.selectedIndex].value);
    w.fillExistingRelationsAll(w);
  });
  
  
  // set name and attrib class for selected anno
  w.relThis.className += ' ' + w.getAnnoClasses(w.anno);
  w.relThis.textContent = w.anno.textContent;
/*  w.revThis.className += ' ' + w.getAnnoClasses(w.anno);
  w.revThis.textContent = w.anno.textContent;*/

  // fill all fields
  w.fillAvailableRelations(w, w.relRel, false);
/*  w.fillAvailableRelations(w, w.revRel, true);*/
  w.fillAvailableAnnos(w, w.relRel, w.relObj, w.relAdd, false);
/*  w.fillAvailableAnnos(w, w.revRel, w.revSub, w.revAdd, true);*/
  w.fillExistingRelationsAll(w);
  
});




