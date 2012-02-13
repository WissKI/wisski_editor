/**
 * $Id: editor_plugin_src.js 2010-03-25 16:30:32Z sivipyat $
 *
 * @author Viktor Pyatkovka, Eugen Meissner, Martin Scholz
 * @copyright Copyright © 2009, WissKI, All rights reserved.
 */
  
(function() {

  tinymce.create('tinymce.plugins.WissKIMenu', {
    
    init : function(ed, url) {
      var t = this;
      t.url = url;
      t.max_menu_items = 20;  // max menu items
      t.max_label_length = 30; // max chars per item
      t.editor = ed;
      t.revision = 0;
      t.core = ed.plugins.wisskicore;
      t.suggest_url = ed.getParam('wisski_suggest_url');  // url to get instance suggestions
      t.menu = null;      // for menu building and caching
      t.menu_items = [];  // for menu building and caching
      t.current_selection_text = "";
      
      if (!t.core && (window.console != undefined)) {
        window.console.error('Wisski Core is not loaded!');
      }
      
      //Load CSS to document
      // this css defines how the menu looks like
      tinymce.DOM.loadCSS(url + '/css/menu.css');
      
      // the menu covers 1/3 of whole editor
      ed.onInit.add(function() {
        $("#edit-body_ifr").width('66%');
      });
      
      
      // implement own version of approved toggle command
      ed.addCommand('wisskiMenuToggleApproved', function(ui, val) {
        tinymce.activeEditor.execCommand('wisskiCoreToggleApproved', false, val.anno);
      });
      
      ed.addCommand('wisskiMenuRequestSuggestions', function(ui, val) {
        t.requestSuggestions(ed, val.data.text, val.data.matchMode, val.data.offset, val.data.limit, val.data.vocabs);
      });


      // command to execute when menu item is selected
      ed.addCommand('wisskiMenuSetAnnotation', function(ui, val, obj) {
        WissKI.editor.tooltips.hideAll();
        if (!val) return;
        ed = tinymce.activeEditor;
        t = ed.plugins.wisskimenu;
        t.core.setAnnotation(ed, val.anno, false);
      });
      

      // set or hide side menu
      t.core.onSelectionAnnoChange.add(function(ed) {

        // menu items depend on whether cursor is on annotation and whether text is selected
        if (t.core.current_sel_range == null) {
          // no text selected
          // whether alternatives shall be shown depends on cursor position
          if (!t.core.current_anno) {
            // cursor/selection does not overlap with an annotation
            // hide menu entries
            if (t.menu) t._hideMenu();
            t.current_selection_text = '';
            
          } else {
            // cursor/selection does overlap with an annotation
            // show alternatives if selection did not change
            var text = t.core.current_anno.textContent;
            if (text != t.current_selection_text) {
              t.requestSuggestions(ed, text, 'exact', 0, t.max_menu_items + 1, null);
              t.current_selection_text = text;
            }
            
          }

        } else {
          // text selected 
          var text;
          if (!t.core.current_anno) {
            text = ed.selection.getRng(true).toString();
          } else {
            text = t.core.current_anno.textContent;
          }
          
          // suggestions will be shown for the selected string if selection did not change
          if (text != t.current_selection_text) {
            t.requestSuggestions(ed, text, 'exact', 0, t.max_menu_items + 1, null);
            t.current_selection_text = text;
          }

        }
          
      });

    },
    

    /** Makes an ajax call to the server to get (alternative) annotation suggestions.
    *   On success, the menu items are displayed
    *   (has been moved from wisski core, as it is only used here)
    */
    requestSuggestions : function(ed, text, matchMode, offset, limit, vocabs) {
      var t = this;
      var rev = ++t.revision;
      if (offset < 0) offset = 0;
      var data = {term : text, match_mode : matchMode, offset : offset, limit : limit};
      if (vocabs && vocabs.length != 0) data['vocabs'] = vocabs;

      t.core.setProgressState(1);
      tinymce.util.XHR.send({
        context_values : {
          text : text,
          offset : offset,
          limit : limit,
          vocabs : vocabs,
          matchMode : matchMode,
          revision : rev,
          current_anno : t.core.current_anno,
          editor : ed
        },
        url : t.suggest_url,
        content_type : "application/json",
        type : "POST",
        data : 'wisski_editor_query=' + tinymce.util.JSON.serialize(data),
        success_scope : t,
        success : t.handleSuggestionsRequest,
        error : function( type, req, o ) {
          if (req.status != 200) {
            t.core.setProgressState(0);
            t.core.db.warn("requestSuggestions: Ajax call not successful.");
            t.core.db.log("Type: ",type);
            t.core.db.log("Status: " + req.status + ' ' + req.statusText);
          }
          // show menu nonetheless (we have the new entry items etc!)
          t.handleSuggestionsRequest("", req, o);
        }
      });
      
    },
    

    // handles a successful ajax call for annotation suggestions
    // the annotations are read and the menu is built
    handleSuggestionsRequest : function(data, xhr_object, send_data) {
      var t = tinymce.activeEditor.plugins.wisskimenu, cm = tinymce.activeEditor.controlManager;
      t.core.setProgressState(0);
      data = tinymce.util.JSON.parse(data);
      var context = send_data.context_values;
//      if (send_data.revision != t.revision) return; // with current_anno, revision should be superfluous
      if (context.current_anno != t.core.current_anno) return; // cursor moved on (maybe it left an anno so cursor change didn't generate new request and revision is equal!)
      
      var items = [];
      
      // add new entry buttons if first page
      if (!context.offset || context.offset == 0) {
        var new_items = t.newAnnoMenuItems(t.core.classes_x_vocabs);
        for (key in new_items) items.push(new_items[key]);
      }
      
      // add requested buttons
      var data_items = t.dataToMenuItems(data);
      var more = false;
      
      var back = (context.offset != 0);  // if we are not on first page, we need a back button

      if (data_items.length != 0) {
//        items.push({label : 'Existing entities', 'class' : 'header'});
      }
      
      var voc_item_count = 0;

      if (t.max_menu_items < items.length + data_items.length + (back ? 1 : 0)) {
        // only add till menu is full, add more/back buttons
        more = true;
        voc_item_count = t.max_menu_items - items.length;
        items = items.concat(data_items.slice(0, voc_item_count));
      } else {
        more = false;
        items = items.concat(data_items);
      }
      
      // more button
      if (more) {
        items.push({
          label : '>>> More',
          cmd : 'wisskiMenuRequestSuggestions',
          data : {
            editor : context.editor,
            text : context.text, 
            offset : context.offset + voc_item_count,
            matchMode : context.matchMode,
            limit : t.max_menu_items + 1  // add 1 for detecting if we should display a "more" button
          }
        });
      }
      
      if (back) { // add back button 
        items.push({
          label : '<<< Back',
          cmd : 'wisskiMenuRequestSuggestions',
          data : {
            editor : context.editor,
            text : context.text, 
            offset : (context.offset - t.max_menu_items > 0) ? context.offset - t.max_menu_items :  0,
            matchMode : context.matchMode,
            limit : t.max_menu_items + 1 // add 1 for detecting if we should display a "more" button
          }
        });
      
      }
      
      
      // show the menu
      t.showMenu(items);
      
      
     
    },

    
    // show the menu
    showMenu : function(items) {
      var ed = tinymce.activeEditor, t = ed.plugins.wisskimenu;

      var m = t.menu;
      if (m) t._hideMenu();
      m = ed.controlManager.createDropMenu('annolist');        
      t.menu = m;
      
      // set the items
      tinymce.each(items, function(item) {
        m.add({
          title : item.label,
          cmd : item.cmd,
          value : item,
          'class' : item.classes
        });
      });

      m.showMenu(0,0);
      t._moveMenu();
      t.menu.showMenu(0,0);

      var tds = $('.mceText');
      if(tds == undefined || tds == null) return;

      for(var i=0; i<tds.length; i++){
        var className = tds[i].parentNode.parentNode.className;
        if(className.match('wisski_anno'))
          $(tds[i]).ttip_set(); // set tooltip infobox for each item
      }

    },
    
    
    // helper function for constucting the tinymce menu objects
    dataToMenuItems : function(data) {
      var t = this, items = [], range, ed = tinymce.activeEditor;
      
      if (t.core.current_anno == null) {
        range = t.core.convertW3CRange(ed, ed.selection.getRng(true));
      } else {
        range = t.core.getElementRange(ed, t.core.current_anno);
      }

      tinymce.each(data, function(annolist, vocab) {
        tinymce.each(annolist, function(anno, uri) {
          var label = null;
          if (anno.label && anno.label.length != 0 && anno.label[0].value) label = anno.label[0].value;
          else if (anno.alt_label && anno.alt_label.length != 0 && anno.alt_label[0].value) label = anno.alt_label[0].value;
          if (label == null) return;

          label += ' (' + t.core.vocabularies[vocab].name + ')';
          if (label.length > t.max_label_length) label = label.substr(0, t.max_label_length - 3) + '...';
          var item = {
            anno : {
              range : range,
              uri : uri,
              voc : vocab,
              class : t.core.vocabularies[vocab].class,
              rank : anno.rank,
              approved : true
            },
            label : label,
            cmd : 'wisskiMenuSetAnnotation',
            classes : 'wisski_anno wisski_anno_approved'
          };
          item.classes += ' wisski_anno_uri_' + encodeURIComponent(uri);
          item.classes += ' wisski_anno_vocab_' + encodeURIComponent(vocab);
          item.classes += ' wisski_anno_class_' + encodeURIComponent(t.core.vocabularies[vocab].class);
          if (anno.rank) item.classes += 'wisski_anno_rank_' + encodeURIComponent(anno.rank);
          items.push(item);
        });
      });

      return items;

    },

    
    // builds menu items for creating new instances of classes
    newAnnoMenuItems : function(classes_x_vocabs) {
      var t = this, range, items = [], ed = tinymce.activeEditor, range, label, itemlabel;
      
      if (t.core.current_anno == null || !ed.selection.isCollapsed()) {
        var rng = ed.selection.getRng(true);
        range = t.core.convertW3CRange(ed, rng);
        label = rng.toString();
      } else {
        range = t.core.getElementRange(ed, t.core.current_anno);
        label = t.core.current_anno.textContent;
      }
      
      itemlabel = '* ' + label;

      tinymce.each(classes_x_vocabs, function(c) {
        var uri = t.core.createURI();
        var item = {
          anno : {
            range : range,
            uri : uri,
            approved : true,
            label : label,
            'new' : true
          },
          label : label,
          cmd : 'wisskiMenuSetAnnotation',
          classes : "wisski_anno wisski_anno_new wisski_anno_approved wisski_anno_label_" + encodeURIComponent(label)
        };
        item.classes += " wisski_anno_uri_" + encodeURIComponent(uri);
        if (c.class) {
          item.anno.class = c.class.id;
          item.classes += ' wisski_anno_class_' + encodeURIComponent(c.class.id);
          item.label = itemlabel + ' (' + c.class.label + ')';
        }
        if (c.vocab) {
          item.anno.vocab = c.vocab.id;
          item.classes += ' wisski_anno_vocab_' + encodeURIComponent(c.vocab.id);
          item.label = itemlabel + ' (' + c.vocab.name + ')';
        }
        if (item.label.length > t.max_label_length) item.label = itemlabel.substr(0, t.max_label_length - 3) + '...';
        items.push(item);
      });

      return items;

    },


    /* Menu Functions */
    
    // Moving menu to editor
    _moveMenu : function() {
      var t = this;
      t.core.db.debug('Moving menu');
      var annolist = $("#menu_edit-body_annolist").clone(true);
      $("#menu_edit-body_annolist").remove();
      annolist.insertAfter("#edit-body_ifr");
      $("#menu_edit-body_annolist").css({
        'position' : 'relative',
        'left' : '0',
        'top' : '0',
        'float' : 'left',
        'zIndex' : '100'
      });
    },

               
   //Destroy menu. s - true if seting _sorted to false needed
    _hideMenu : function(s) {
      var t = this;
      if (t.menu) {
        t.core.db.debug('Hiding menu');
        t.menu.removeAll();
        t.menu.destroy();
        t._sorted = (s) ? false : t._sorted;
        t.menu = undefined;
      }
    },
    
    getInfo : function() {
      return {
        longname : 'WissKI Menu',
        author : 'Viktor Pyatkovka',
        authorurl : 'http://localhost/wisski',
        infourl : 'http://localhost/wisski',
        version : tinymce.majorVersion + "." + tinymce.minorVersion
      };
    }
  });
  
  // Register plugin
  tinymce.PluginManager.requireLangPack('wisskicore');
  tinymce.PluginManager.add('wisskimenu', tinymce.plugins.WissKIMenu);
})();
