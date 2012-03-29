/**
 * $Id$
 *
 * @author Martin Scholz
 * @copyright Copyright © 2009, WissKI, All rights reserved.
 */


(function() {
			
	tinymce.create('tinymce.plugins.wisskiAggregation', {

		init : function(ed, url) {
			var t = this;
      t.editor = ed;
      t.core = ed.plugins.wisskicore;

      //Load CSS to document
			//tinymce.DOM.loadCSS(url + '/css/menu.css');
			
			// button for showing dialog for editing links between annos
      // active when cursor on an annotation
      ed.addButton('wisskiAggregationShowDialog', {
        image : url + '/img/aggregation.gif',
        cmd: 'wisskiAggregationShowDialog'
      });
      
      // the command that pops up the dialog
      ed.addCommand('wisskiAggregationShowDialog', function() {
        var ed = tinymce.activeEditor, t = ed.plugins.wisskiAggregation;
        
        var anno = t.core.current_anno;
        var anno_class = t.core.getAnnoClass(anno);
        
        var allAnnos = t.core.getAllAnnotations(ed);
        var allAnnosSorted = t.sortAnnosByClass(allAnnos);
        var properties = t.sortAvailableProperties(anno_class);
        
        ed.windowManager.open({
          file : url + '/manual_aggregation_dialog.html',
          title : 'Edit relations',
          width : 380,
          height : 400,
          inline : 1,
          close_previous : true
        }, {
          plugin_url : url,
          t : t,
          editor : ed,
          anno : anno,
          anno_class : anno_class,
          annos : allAnnosSorted,
          properties : properties
        });
        
			});
      
      
      t.core.onAnnoChange.add(function(ed, cm, current_anno) {
        cm.setDisabled('wisskiAggregationShowDialog', current_anno == null);
      });

		},
    
    
    // helper function: get a list of properties for class clazz or all classes if clazz is null
    // @return an object with keys
    // - by_id: value is an object where the keys are the property id
    //   and value is the property description
    // - by_range: value is an object where the keys are the class id
    //   and value is an object with property ids - property description key value pairs.
    //   Only properties that have the class as range are listed.
    // - by_domain: value is an object where the keys are the class id
    //   and value is an object with property ids - property description key value pairs.
    //   Only properties that have the class as domain are listed.
    //
    sortAvailableProperties : function(clazz) {
      var t = this;
      var properties = {by_range : {}, by_id : {}, by_domain : {}};
      
      tinymce.each(t.core.ontology.properties, function(p) {
        if (clazz === null || p.domain == clazz) {
          properties.by_id[p.id] = p;
          tinymce.each(p.range, function(r) { // r is the range class id
            if (!properties.by_range[r]) properties.by_range[r] = {};
            properties.by_range[r][p.id] = p;
          });
        }
        tinymce.each(p.range, function(r) {
          if (clazz === null || p.range == clazz) {
            properties.by_id[p.id] = p;
            if (!properties.by_domain[p.domain]) properties.by_domain[p.domain] = {};
            properties.by_domain[p.domain][p.id] = p;
          }
        });
      });

      return properties;

    },

    
    // helper function: map annotations annos to the class they belong to
    // @return an object with keys being the class ids and
    // value an array of annos
    sortAnnosByClass : function(annos) {
      var t = this, annosByClass = {};

      tinymce.each(t.core.ontology.classes, function(c) {
        annosByClass[c.id] = [];
        tinymce.each(annos, function(a) {
          if (t.editor.dom.hasClass(a, 'wisski_anno_class_' + encodeURIComponent(c.id))) {
            annosByClass[c.id].push(a);
          }
        });
      });

      return annosByClass;

    },
    
    
		getInfo : function() {
			return {
				longname : 'WissKI Event Aggregation',
				author : 'Martin Scholz',
				authorurl : '',
				infourl : '',
				version : "1.0"
			};
		}
     
	});
	
	// Register plugin
	tinymce.PluginManager.add('wisskiAggregation', tinymce.plugins.wisskiAggregation);	
})();
