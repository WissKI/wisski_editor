
module wisski_editor
=============================

Extends the Javascript WYSIWYG editor TinyMCE (www.tinymce.com) to annotate
text using the groups defined in WissKI and the triple data.

Installation instructions
=============================

Before you install this module you should
1) install the wysiwyg module
2) install TinyMCE according to the instructions of the wysiwyg module.

Then you can set up this module:
1) copy the module files to your directory sites/all/modules
2) download the jQuery qTip version 1.x library from
<http://craigsworks.com/projects/qtip/download/> or from 
<https://github.com/Craga89/qTip1> and copy the jquery.qtip.js file to
wisski_editor/tooltip_plugin/lib.
3) activate this module. The install procedure will automatically generate an
input format for use with the editor extensions and preconfigure the editor
plugins. You can later administrate it manually by clicking Site Configuration
-> Wysiwyg profiles and then click Edit on the profile.
4) Click Site Configuration -> WissKI module settings -> Editor and specify
colors and icons for the defined groups. Specify, of which groups new instances
may be created with the editor and instances of which classes are to be
considered places. For both fields type in a ws-separated list of group ids.

License
=============================

All files except the image files in
./tinymce_plugins/wisski[core|progress]/img/ are licensed under the same terms
as Drupal itself, i.e. the GNU GPLv2 or later; see LICENSE.txt.
For the licensing of the image files see README.txt's in the respective
directories.
