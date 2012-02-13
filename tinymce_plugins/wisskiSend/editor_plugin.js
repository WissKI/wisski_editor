/**
* Wisski Send -- send text content to server and get annotations
* This was formerly part of the wisskicore plugin
* @author Eugen Meissner (2011), Martin Scholz (2011-)
*/



(function() {
 
  tinymce.create('tinymce.plugins.WissKISend',{

    getInfo : function() {
        return {
        longname : 'Wisski Send',
        author : 'Eugen Meissner, Martin Scholz'
        };
    },

    isautosend : false, // if true, the text will be send periodically automatically
    revision : 0, // revision increment to identify the last post
    textChanged : true, // state, if text has changed since last send
    interval : 10000, // interval for automatic sending
    url : '', // the url to send the text to

    init : function(ed, url) {
      var t = this;
    
      if (!ed.plugins.wisskicore) {
        alert('Module WissKICore is not loaded!');
        return;
      }  

      t.core = ed.plugins.wisskicore;
      t.interval = ed.getParam('wisskiSend_interval');
      t.url = ed.getParam('wisskiSend_url');
      
      // button to toggle automatic sending of the text
      ed.addButton('wisski_autosend', {
        title : 'Autosend',
        label : 'Autosend', 
        onclick : function() { 
          t.toggleAutosend(ed);
        }
      });
      
      // button to send the text manually
      // the button will be disabled if automatic sending is on
      ed.addButton('wisski_manualsend', {
        title : 'Manualsend',
        label : 'Send',
        onclick : function() {
          t.sendText(ed);
        }
      });
      
      ed.onInit.add(function() {
        // set default values and button states
        t.isautosend = ed.getParam('wisskiSend_autosend') == 'true';
        ed.controlManager.setDisabled('wisski_manualsend', t.isautosend);
        ed.controlManager.setActive('wisski_autosend', t.isautosend);
        // set up periodic check
        var periodic = window.setInterval(function() {
          // only if activated and text has changed
          // then send text automatically
          if (t.isautosend && t.textChanged) {
            t.textChanged = false;
            t.core.db.warn('periodic!');
            t.sendText(ed);
          }
        }, t.interval);
      });

      ed.onChange.add(function(ed, l) {
        t.textChanged = true;
      });

    },

    
    // toggle automatic sending; update button states
    toggleAutosend : function(ed) {
      var t = this;
      ed.plugins.wisskiprogress.setProgressState(0);
      t.isautosend = !t.isautosend;
      ed.controlManager.setDisabled('wisski_manualsend', t.isautosend);
      ed.controlManager.setActive('wisski_autosend', t.isautosend);
    },
    

    // sends the text to the server using AJAX call
    sendText : function(ed) {
      var t = this;
      var data = {};  // the json data to be sent
      t.revision++;   
      data.rev = t.revision;  // store the new revision in the call metadata
      data.text = ed.getContent({format : 'raw'});  // we want the text with html tags
     
      t.core.setProgressState(1); // set busy sending state

      t.core.db.log("Send text data", data);
      
      // ajax call
      tinymce.util.XHR.send({
         url : t.url,
         content_type : "application/json",
         type : "POST",
         data : tinymce.util.JSON.serialize(data),
         success_scope : t, // set this plugin object as scope for the callback
         success : t.processResponse,
         error : function( type, req, o ) {
          if (req.status != 200) {
            t.core.setProgressState(0);
            t.core.db.warn("Ajax call not success.");
            t.core.db.log("Type: ",type);
            t.core.db.log("Status: " + req.status + ' ' + req.statusText);
          }
         }
       });
    },
    

    // process a successful  ajax response
    processResponse : function(data, req, o) {
      var t = this, ed = tinymce.activeEditor;
      
      t.core.db.log("Recieved text annotations", data);

      t.core.setProgressState(0);
      data = (t.core._isObject(data)) ? data : tinymce.util.JSON.parse(data);
      if (data == undefined) {
        t.db.warn('No response.');
        return;
      } 
      
      if (data.rev != t.revision) return;  // this is not the current request
      
      // set all retrieved annotations
      tinymce.each(data.annos, function(anno) {
        t.core.setAnnotation(ed, anno, false);
      });
    
    }

  });

  tinymce.PluginManager.add('wisskiSend', tinymce.plugins.WissKISend);
 })();
