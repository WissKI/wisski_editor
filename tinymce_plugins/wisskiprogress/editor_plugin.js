/**
 * $Id: editor_plugin_src.js 2010-03-25 16:30:32Z sivipyat $
 *
 * @author Viktor Pyatkovka
 * @copyright Copyright © 2009, WissKI, All rights reserved.
 */
  
(function() {
			
	tinymce.create('tinymce.plugins.WissKIProgress', {
		
    counter : 0,

		init : function(ed, url) {
			var t = this;

			//Load CSS to document
			tinymce.DOM.loadCSS(url + '/css/menu.css');
			
			ed.addButton('wisski_progress', {image : url + '/img/progress.gif'});
			
			ed.onInit.add(function() {
				t.setProgressState(false);
			});
			
			this.onSetProgressState = new tinymce.util.Dispatcher(this);
		},
		
		setProgressState : function(set) {
      if (set) {
        this.counter++;
      } else {
        if (this.counter > 0) this.counter--;
      }
			tinymce.activeEditor.controlManager.setDisabled('wisski_progress', (this.counter == 0));
			this.onSetProgressState.dispatch(tinymce.activeEditor, set);
		},
		
		getInfo : function() {
			return {
				longname : 'WissKI Progress',
				author : 'Viktor Pyatkovka',
				authorurl : 'http://localhost/wisski',
				infourl : 'http://localhost/wisski',
				version : tinymce.majorVersion + "." + tinymce.minorVersion
			};
		}
		
	});
	
	// Register plugin
	tinymce.PluginManager.add('wisskiprogress', tinymce.plugins.WissKIProgress);	
})();
