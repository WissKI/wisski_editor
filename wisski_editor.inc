<?php



/** Create the annotation css file
* @Martin Scholz, Florian Wittmann
*/
function wisski_editor_create_css_file() {
  
  // read all css template files
  $path = drupal_get_path('module', 'wisski_editor') . '/'; 
  $templategroup = file_get_contents($path . "template_group.css");
  $templategroup_noicon = file_get_contents($path . "template_group_no_icon.css");
  $templatedefault = file_get_contents($path . "template_default.css");

  // write the default settings
  $wisskicss = str_replace("%COLOR%" , variable_set('wisski_editor_groupcolor_default', '#CCCCCC'), $templatedefault);

  // for every top group of the import PB section
  // write adapt css template  with icon and color information
  module_load_include('inc', 'wisski_pathbuilder');
  foreach (wisski_pathbuilder_getEnabledGroups(3) as $id) {
    
    $color = variable_get('wisski_editor_groupcolor_'.$id, '');  
    $icon = variable_get('wisski_editor_groupicon_'.$id, NULL);
        
    // replace tokens in template 
    $grpcolor = (empty($icon)) ? $templategroup_noicon : $templategroup;
    $grpcolor = str_replace("%TYPE%", $id, $grpcolor);
    if (!empty($icon)) $grpcolor = str_replace("%ICON%", file_create_url($icon), $grpcolor);
    $grpcolor = str_replace("%COLOR%", $color, $grpcolor);
    $wisskicss .= "\n" . $grpcolor;

  }
  
  $css_file = variable_get('wisski_editor_css_file', NULL);
  file_delete($css_file);
  $file = file_save_data($wisskicss, 'wisski_editor.css');
  variable_set('wisski_editor_css_file', $file);
  
}




/* Internal functions; for dcoumentation see module file 
*/



/* Internal implementation of hook_wysiwyg_plugin
* Provide information about plugins
*
* @author Martin Scholz
*
*/
function _wisski_editor_wysiwyg_plugin($editor, $version) {
  if ($editor != 'tinymce') return;
  
  $path_wisski_editor = drupal_get_path('module', 'wisski_editor');

  global $base_root, $base_path;

  $plugins = array(
      // Provides core functionality like methods for (un)setting annotations
      // Should always be loaded
      'wisskicore' => array(
        'path' => $path_wisski_editor . '/tinymce_plugins/wisskicore/editor_plugin.js',
        'extensions' => array('wisskicore' => t('Wisski Core')),
        'buttons' => array('wisskiCoreToggleApproved' => t('Approve Annotation'), 'wisskiCoreDeleteAnno' => t('Delete Annotation')),
        'options' => array(
          // callback url for entity suggestions
          // see also wisski_editor_ws_suggest()
          'wisski_suggest_url' => $base_root . $base_path . 'wisski/editor/suggest',
          // callback url for entity information
          // see also wisski_editor_ws_about()
          'wisski_about_url' => $base_root . $base_path . 'wisski/editor/about',
          // base url for creating new instance URIs
          'wisski_instance_base_url' => $base_root . $base_path . 'content/',
          // the ontology / available groups
          'wisski_ontology' => wisski_editor_build_ontology(),
          // whether to include RDFa attributes in annotation tags
          'wisski_use_rdfa' => variable_get('wisski_editor_use_rdfa', TRUE),
          // list of classes/groups of which new instances can be created from
          // for all other available classes only existing instances may be chosen
          'instantiable_classes' => variable_get('wisski_editor_instantiable_groups', array()),
          ),
        'load' => TRUE,
        'extended_valid_elements' => array('span[typeof|about|*]'),
        ),
      // Handles the right-hand side shortcut menu
      'wisskimenu' => array(
        'path' => $path_wisski_editor . '/tinymce_plugins/wisskimenu/editor_plugin.js',
        'extensions' => array('wisskimenu' => t('Wisski Menu')),
        'options' => array('menu' => 'side'), // is this effective anymore?
        'load' => TRUE,
        ),
      // sends the text to server and retrieves automatically generated annotations 
      'wisskiSend' => array(
          'path' => $path_wisski_editor . '/tinymce_plugins/wisskiSend/editor_plugin.js',
          'extensions' => array('wisskiSend' => t('WissKI Send')),
          'buttons' => array('wisski_autosend' => t('Wisski Toggle Autosend'), 'wisski_manualsend' => t('Wisski Manual Send')),
          'options' => array(
            'wisskiSend_autosend' => variable_get('wisski_editor_autosend', FALSE) ? 'true' : 'false',
            'wisskiSend_interval' => variable_get('wisski_editor_send_interval', 5000),
            'wisskiSend_url' => $base_root . $base_path . 'wisski/editor/analyse',
            ),
          'load' => TRUE,
          ),
      // Display a progress button in the toolbar
      // If this module is disabled, the editor will be blocked when text is send to server
      'wisskiprogress' => array(
          'path' => $path_wisski_editor . '/tinymce_plugins/wisskiprogress/editor_plugin.js',
          'buttons' => array('wisski_progress' => t('Wisski Progress')),
          'options' => $options,
          'load' => TRUE,
          ),
      // Provide functionality and a dialog for setting links
      // between annotations/entities
      'wisskiAggregation' => array(
          'path' => $path_wisski_editor . '/tinymce_plugins/wisskiAggregation/editor_plugin.js',
          'buttons' => array('wisskiAggregationShowDialog' => 'Aggregate Entities'),
          'options' => array(),
          'load' => TRUE,
          ),
      );

  return $plugins;
}



/* Build the ontology ie. consisting of groups and paths
*
*
* @author Martin Scholz
*
*/
function _wisski_editor_build_ontology($subgroups_as_events = FALSE) {

  include_once(drupal_get_path('module', 'wisski_pathbuilder') . '/wisski_pathbuilder.inc');
  //  $groups_by_id = array(
  //    'literal' => array(
  //      'id' => 'literal',
  //      'label' => 'Literal',
  //      'domain_for' => array(), // nothing!
  //      'range_for' => array(), //every possible property (for new entries!)
  //  );

  // Treat top groups as classes and
  // subgroups (= events) as subclasses of this class
  $group_ids_by_cl = array();
  $groups_by_id = array();
  $event_ids_by_cl = array();
  $events_by_id = array();
  foreach (wisski_pathbuilder_getEnabledGroups() as $gid) {
    $group_data = wisski_pathbuilder_getPathData($gid);
    $path_array = _wisski_pathbuilder_calculate_group_samepart($gid);
    
    if ($group_data['group_id'] < 1) {  // top group
      
      $uri = $path_array['x0'];
      $group = array(
          'id' => $gid,
          'label' => $group_data['name'],
          'uri' => $uri,
          'domain_for' => array(),  // will be set later
          'range_for' => array(),   // idem
          );
      $groups_by_id[$gid] = $group;
      $group_ids_by_cl[$uri][] = $gid;

    } elseif ($subgroups_as_events) {
      
      $uri = $path_array['x' . (floor(count($path_array) / 2) + 1)];
      $group = array(
          'id' => $gid,
          'label' => $group_data['name'],
          'uri' => $uri,
          'parent' => $group_data['group_id'],
          'domain_for' => array(),  // will be set later
          'range_for' => array(),   // idem
          );
      $events_by_id[$gid] = $group;
      $event_ids_by_cl[$uri][] = $gid;

    }

  }
  // gather properties by looking at paths& groups defined in each top group
  $props_by_id = array();
  $event_props_by_id = array();
  foreach ($groups_by_id as $gid => $group) {
    foreach (wisski_pathbuilder_getAllMembers($gid, $subgroups_as_events) as $pid) {
      $path_data = wisski_pathbuilder_getPathData($pid);
      if (!$path_data['enabled']) continue;
      
      if (!$path_data['is_group']) {
        $path_array = unserialize($path_data['path_array']);
        $path = array(
            'id' => $pid,
            'label' => $path_data['name'],
            'domain' => $subgroups_as_events ? $path_data['group_id'] : $gid,
            'range' => array(),
            );
        for ($i = $path_data['length']; $i > 0; $i--) {
          if (isset($group_ids_by_cl[$path_array["x$i"]])) {
            $groups_by_id[$gid]['domain_for'][] = $pid;
            $range_group_ids = $group_ids_by_cl[$path_array["x$i"]];
            foreach ($range_group_ids as $range_group_id) {
              if (!in_array($range_group_id, $path['range'])) {
                $path['range'][] = $range_group_id;
                $groups_by_id[$range_group_id]['range_for'][] = $pid;
              }
            }
          }
        }
        //      $path['range'][] = 'literal';
        if ($path['range']) {
          $props_by_id[$pid] = $path;
        }

      } else {  // is a subgroup

        $path = array(
            'id' => $pid,
            'label' => $path_data['name'],
            'domain' => $path_data['group_id'],
            'range' => array($pid),
            );
        $props_by_id[$pid] = $path;

      }
    }
  }

  $ontology = array(
      'classes' => $groups_by_id + $events_by_id,
      'properties' => $props_by_id,
      );

  return $ontology;

}



