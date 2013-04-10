<?php



/** The editor admin settings form
* @author Martin Scholz, Florian Wittmann
*/
function wisski_editor_admin_settings($form_state) {

  drupal_load('module', 'wisski_pathbuilder');
  include_once(drupal_get_path('module', 'wisski_pathbuilder') . '/wisski_pathbuilder.inc');

  //for pb_group: display every top group of the import PB section
  $pb_groups = array();
  foreach (wisski_pathbuilder_getEnabledGroups(3) as $id) {
    $info = wisski_pathbuilder_getPathData($id);
    if ($info['group_id'] < 1) $pb_groups["$id"] = $info['name'];
  }
  
  //for filterformats:
  $filter_formats = array();
  foreach (filter_formats() as $id) {
	$filter_formats[$id->format] = $id->name;
	//drupal_set_message('<pre>'. print_r($id, TRUE) .'</pre>');
  } 
    
  global $base_root, $base_path;
  $iconpath = $base_root . $base_path.file_directory_path() . '/';
  $icon_approved = $iconpath . variable_get('wisski_editor_icon_approved','noicon.jpg');
  $icon_delete = $iconpath . variable_get('wisski_editor_icon_delete','noicon.jpg');

  $form = array();
  $form['#attributes'] = array('enctype' => "multipart/form-data");


  $form['framesettings'] = array(
      '#type' => 'fieldset',
      '#title' => t('Settings'),
      '#required' => TRUE,
      '#weight' => 2,

      'place_groups' => array(
        '#type' => 'select',
        '#title' => t('Place groups'),
        '#multiple' => true,
        '#options' => $pb_groups,
        '#default_value' => variable_get('wisski_editor_place_groups', array()),
        ),

      'input_format' => array(
        '#type' => 'select',
        '#multiple' => false,
        '#options' => $filter_formats,
        '#title' => t('Input format'),
        '#default_value' => variable_get('wisski_editor_input_format', ''),
        ), 
        


      'show_triples' => array(
        '#type' => 'checkbox',
        '#title' => t('Show triples before store'),
        '#default_value' => variable_get('wisski_editor_showTriplesBeforeStore', TRUE),
        ),

      'instantiable_groups' => array(
          '#type' => 'select',
          '#multiple' => true,
          '#options' => $pb_groups,
          '#title' => t('Groups of which instances may be created'),
          '#default_value' => variable_get('wisski_editor_instantiable_groups',  array()),
          ),
          
      'use_rdfa' => array(
          '#type' => 'checkbox',
          '#title' => t('Encode entities also in RDFa.'),
          '#default_value' => variable_get('wisski_editor_use_rdfa', TRUE),
          ),
      'show_tooltips_for_form' => array(
          '#type' => 'checkbox',
          '#title' => t('Show tooltips infobox in structured data form'),
          '#default_value' => variable_get('wisski_editor_show_tooltips_for_form', FALSE),
          ),
      );


  $form['framegroups'] = array(
      '#type' => 'fieldset',
      '#title' => t('Gruppen'),
      '#required' => TRUE,
      '#weight' => 1,

      );

  $form['framegroups']['clpdefault'] = array(
      '#type' => module_exists('colorpicker') ? 'colorpicker_textfield' : (module_exists('jquery_colorpicker') ? 'colorpicker' : 'textfield'),
      '#title' => t('Default color'),
      '#default_value' => variable_get('wisski_editor_groupcolor_default', '#808080'),
      );

  foreach ($pb_groups as $id => $grp) {
    // Add icon and color settings for each group

    $icon = variable_get('wisski_editor_groupicon_'.$id, NULL);
    $form['framegroups']['group'.$id] = array(
        '#type' => 'fieldset',
        '#title' => $grp,
        );
    $form['framegroups']['group'.$id]['clp'.$id] = array(
        '#type' => module_exists('colorpicker') ? 'colorpicker_textfield' : (module_exists('jquery_colorpicker') ? 'colorpicker' : 'textfield'),
        '#title' => t('Color'),
        '#default_value' => variable_get('wisski_editor_groupcolor_'.$id, '#808080'),
        );
    $form['framegroups']['group'.$id]['icon'.$id] = array(
        '#type' => 'item',
        '#title' => t('Current icon'),
        '#value' => (empty($icon)) ? t('no icon') : '<img src="' . file_create_url($icon) . '">',
        );       
    $form['framegroups']['group'.$id]['iconup'.$id] = array(
        '#type' => 'file',
        '#title' => t('Upload icon'),
        );    
  }

  $form['submit'] = array(
      '#type' => 'submit',
      '#value' => t('Save'),
      '#weight' => 10,
      );


  return $form;

}



/**
* @author Martin Scholz, Florian Wittmann
*/
function wisski_editor_admin_settings_submit($form, $form_state) {

  variable_set('wisski_editor_place_groups', $form_state['values']['place_groups']);
  variable_set('wisski_editor_instantiable_groups', $form_state['values']['instantiable_groups']);
  variable_set('wisski_editor_input_format', $form_state['values']['input_format']);
  variable_set('wisski_editor_use_rdfa', $form_state['values']['use_rdfa']);
  variable_set('wisski_editor_showTriplesBeforeStore', $form_state['values']['show_triples'] ? TRUE : FALSE);
  variable_set('wisski_editor_show_tooltips_for_form', $form_state['values']['show_tooltips_for_form'] ? TRUE : FALSE);

  //save colors and icons:
  variable_set('wisski_editor_groupcolor_default', $form_state['values']['clpdefault']);
  
  //save icon and color for every top group of the import PB section
  foreach (wisski_pathbuilder_getEnabledGroups(3) as $id) {
    variable_set('wisski_editor_groupcolor_'.$id, $form_state['values']['clp'.$id]);  
    if ($file = file_save_upload('iconup'.$id, array(), file_directory_path())) {
      file_set_status($file, FILE_STATUS_PERMANENT);
      variable_set('wisski_editor_groupicon_'.$id, $file->filepath);
    }
  }

  module_load_include('inc', 'wisski_editor');
  wisski_editor_create_css_file();
  drupal_set_message(t('Settings were stored successfully.'));

}


