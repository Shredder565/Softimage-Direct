// Ledger row CMD-B7c: the category table of RTShaderSetCategories.
// Brief: docs/ghidra/cmd-b7c-addon-scripts.md, "Wire contract: RTUserTools" (table rows 1 to 230, in table order).
// One row per line: shader name | category | display name | thumbnail | strip rule (M or T). Empty = not set.
// Generated from the note's table; do not edit by hand.
export interface ShaderCategoryRow { shader: string; category: string; displayName: string; thumbnail: string; strip: '' | 'M' | 'T' }

const TABLE = `
material-phong|Illumination@100/@100||ML_phong_apple.bmp|
material-lambert|Illumination@100/@100||ML_lambert_apple.bmp|
mia_material_phen|Illumination@100/@100|Architectural||
material-blinn|Illumination@100/@100|Blinn|ML_blinn_apple.bmp|
material-cooktorr|Illumination@100/@100|Cook-Torrance|ML_cooktorrance_apple.bmp|
material-strauss|Illumination@100/@100|Strauss|ML_strauss_apple.bmp|
material-ward|Illumination@100/@100|Anisotropic|ML_anisotropic_apple.bmp|
material-constant|Illumination@100/@100|Constant|ML_consant_apple.bmp|
misss_fast_simple_phen|Illumination@100/@200|Fast Simple (misss)||
misss_fast_skin_phen|Illumination@100/@200|Fast Skin (misss)||
material-moviescreen|Illumination@100/@400|Flat Light|ML_Flat_Light_Apple.bmp|
sib_incidence_v3|Illumination@100/@400|Incidence|ML_incidence_apple.bmp|
sib_photon_matte|Illumination@100/@400|Photon Irradiance|photon_irradiance.bmp|
sib_illum_shadowmaterial|Illumination@100/@400|Shadow|shadow.bmp|
sib_shadow_basic|Illumination@100/@400|Simple Shadow|shadow.bmp|
sib_illum_moviescreen|Illumination@100/@400|Flat Light Shading|ML_Flat_Light_Apple.bmp|
XSIAmbientOcclusion|Illumination@100/@400|||
rh_renderer|Illumination@100/@500|||
sib_geo_hair_illum|Illumination@100/@500|||
mip_card_opacity|Illumination@100/@600|Card/Opacity (mip)||
mip_matteshadow|Illumination@100/@600|Matte Shadow (mip)||
mi_car_paint_phen|Illumination@100/@600|Car Paint||
mia_material|Illumination@100/@600|Architectural (Multi-out)||
txt2d-image-explicit|Texture@100/@100|Image|Image_Lookup.bmp|
txt2d-scalarimage-explicit|Texture@100/@100|Scalar Image|Image_Lookup.bmp|
mip_cameramap|Texture@100/@100|Camera Map (mip)|Image_Lookup.bmp|
mia_light_surface|Texture@100/@100|Light Surface (mia)|light.bmp|
sib_sprite|Texture@100/@100|Sprite|Sprite.bmp|
txt3d-cellular_v3|Texture@100/@200||cell.bmp|
BA_cell_scl|Texture@100/@200||cell.bmp|
txt3d-checkerboard|Texture@100/@200||checker.bmp|
txt3d-cloud|Texture@100/@200||cloud.bmp|
txt2d-fabric|Texture@100/@200||fabric.bmp|
txt3d-flagstone_v3|Texture@100/@200||flagstone.bmp|
txt3d-fractal_v3|Texture@100/@200||fractal.bmp|
BA_fractal4d2_scl|Texture@100/@200||fractal.bmp|
txt2d-gradient_v2|Texture@100/@200||gradien.bmp|
txt2d-grid|Texture@100/@200||grid.bmp|
txt3d-marble|Texture@100/@200||marble.bmp|
txt2d-ripple_v3|Texture@100/@200||ripple.bmp|
txt3d-rock_v3|Texture@100/@200||rock.bmp|
txt3d-snow|Texture@100/@200||snow.bmp|
txt2d-terrain|Texture@100/@200||terrain.bmp|
txt3d-vein_v3|Texture@100/@200||vein.bmp|
txt3d-wood|Texture@100/@200||wood.bmp|
XSIModelMap|Texture@100/@200|||
XSIVDM|Texture@100/@300|||
BA_particle_density3|Particle@100/@100||particle.bmp|
BA_particle_gradient_phen|Particle@100/@100||particles.bmp|
BA_particle_gradientcontrol|Particle@100/@100||particles.bmp|
BA_particle_info|Particle@100/@100||particles.bmp|
BA_volume_cloud|Particle@100/@100||particle.bmp|
sitoon_host|Toon@100/@100||ML_toon_apple.bmp|
sitoon_paint|Toon@100/@100||ML_toon_apple.bmp|
sitoon_paint_and_host|Toon@100/@100||ML_toon_apple.bmp|
sitoon_paint_ambient|Toon@100/@100||ML_toon_apple.bmp|
sitoon_paint_rounded|Toon@100/@100||ML_toon_apple.bmp|
sitoon_paint_rimlight|Toon@100/@100||ML_toon_apple.bmp|
sitoon_paint_highlight|Toon@100/@100||ML_toon_apple.bmp|
sitoon_ink|Toon@100/@200|Toon Ink Lens|ML_toon_apple.bmp|
GLSLProgram|Realtime@200/OpenGL||glsl.bmp|
GLSLUniform|Realtime@200/OpenGL||glslu.bmp|
OGL13Texture|Realtime@200/OpenGL||OGL.bmp|
OGLParticle|Realtime@200/OpenGL||particle.bmp|
sib_zbump|Bump@300||bump.bmp|
sib_bumpmap_gen|Bump@300||bump.bmp|
sib_bump|Bump@300||bump.bmp|
XSINormalMap3|Bump@300||bump.bmp|
mia_roundcorners|Bump@300|Round Corners (mia)|bump.bmp|
sib_env_cubic1|Environment@300|Cubic Mapping 1|cubic.bmp|
mip_grayball|Environment@300|Gray Ball (mip)||
mip_mirrorball|Environment@300|Mirror Ball (mip)||
sib_env_spherical|Environment@300|Spherical Mapping|spherical.bmp|
mia_envblur|Environment@300|Environment Blur (mia)||
sib_environment|Environment@300|Environment|spherical.bmp|
sib_env_cubic6|Environment@300|Cubic Mapping 6|cubic6.bmp|
mia_physicalsky|Environment@300|Physical Sky (mia)||
mia_physicalsun|Light@300/@100|Physical Sun (mia)|light.bmp|
mia_portal_light|Light@300/@100|Portal Light (mia)|light.bmp|
soft_light|Light@300/@200|Soft Light|light.bmp|
Bionic_Light_lit|Light@300/@200|Fast Light Effects|light.bmp|
sib_slide_proj_light|Light@300/@200|Slide Projector|light.bmp|
dense_vol|Volume@300||Volume.bmp|
Bionic_Volume_vol|Volume@300|Fast Volume Effects|Volume.bmp|
soft_fog|Volume@300|Fog|Volume.bmp|
soft_layered_fog|Volume@300|Layered Fog|Volume.bmp|
sib_lightning|Volume@300||Volume.bmp|
smoke_vol|Volume@300|Smoke|Volume.bmp|
March_Fractal_vol|Volume@300|Volume Effects|Volume.bmp|
Lume_Beam|Volume@300|Lume Beam|Volume.bmp|
mia_lens_bokeh|Lens@300/@100|Bokeh (mia)|lens.bmp|
Lume_Distortion|Lens@300/@100||lens.bmp|
mia_exposure_photographic|Lens@300/@100|Photographic Exposure (mia)|lens.bmp|
mia_exposure_simple|Lens@300/@100|Simple Tone Mapping (mia)|lens.bmp|
Cylindric_len|Lens@300/@200|Panoramic|lens.bmp|
sib_dof|Lens@300/@200||lens.bmp|
sib_fisheye|Lens@300/@200||lens.bmp|
sib_fx_lens|Lens@300/@200|Lens Effects|lens.bmp|
NSTEREO_LEN|Lens@300/@200|Steroscopic|lens.bmp|
sib_lens_depth|Lens@300/@200|Z Depth|lens.bmp|
mib_lookup_background|Lens@300/@200|Camera Projection|lens.bmp|
mip_motionblur|Output@300/@100|2D Motion Blur|output.bmp|
sib_flatten_depth|Output@300/@100|Flatten Depth|output.bmp|
mip_motion_vector|Output@300/@100|Motion Vector (mip)|output.bmp|
sib_lightmap_color_sampler|Lightmap@300/@100|||
misss_lightmap_write|Lightmap@300/@200|Sub-Surface Lightmap Write||
sib_attribute_boolean|Data@400/Attribute|||
sib_attribute_color|Data@400/Attribute|||
sib_attribute_integer|Data@400/Attribute|||
sib_attribute_scalar|Data@400/Attribute|||
sib_attribute_transform|Data@400/Attribute|||
sib_attribute_vector|Data@400/Attribute|||
sib_boolean_storeinchannel|Data@400/Render Channel|Store Boolean in Channel||
sib_color_storeinchannel|Data@400/Render Channel|Store Color in Channel||
sib_integer_storeinchannel|Data@400/Render Channel|Store Integer in Channel||
sib_scalar_storeinchannel|Data@400/Render Channel|Store Scalar in Channel||
sib_vector_storeinchannel|Data@400/Render Channel|Store Vector in Channel||
mib_texture_lookup|Data@400/Map Lookup|Image Lookup|Image_Lookup.bmp|
map_lookup_boolean|Data@400/Map Lookup||Map_Lookup.bmp|
map_lookup_color|Data@400/Map Lookup||Map_Lookup.bmp|
map_lookup_integer|Data@400/Map Lookup||Map_Lookup.bmp|
map_lookup_scalar|Data@400/Map Lookup||Map_Lookup.bmp|
map_lookup_vector|Data@400/Map Lookup||Map_Lookup.bmp|
sib_vertex_color_alpha|Data@400/Map Lookup||Map_Lookup.bmp|
sib_state_scalar|Data@400/Shading State/@100||State.bmp|
sib_state_vector|Data@400/Shading State/@100||State.bmp|
sib_savestate_color|Data@400/Shading State/@200||State.bmp|
sib_savestate_scalar|Data@400/Shading State/@200||State.bmp|
sib_savestate_vector|Data@400/Shading State/@200||State.bmp|
sib_channel_picker|Processing@400/Color Channels/@100|Picker|Color_Channel.bmp|
sib_color_split|Processing@400/Color Channels/@100|RGBA Split|Color_Channel.bmp|
sib_color_transparency_matte|Processing@400/Color Channels/@200||Color_Matte.bmp|
sib_scalar_transparency_matte|Processing@400/Color Channels/@200||Scalar_Matte.bmp|
sib_hlsa_combine|Processing@400/Color Channels/@300|HLSA Combine|Color_Channel.bmp|
sib_hsva_combine|Processing@400/Color Channels/@300|HSVA Combine|Color_Channel.bmp|
sib_color_combine|Processing@400/Color Channels/@300|RGBA Combine|Color_Channel.bmp|
mib_color_alpha|Processing@400/Color Channels/@400|Color to Alpha|Color_Channel.bmp|
sib_color_correction|Processing@400/Image Processing/@100||Im_Pro_Correct.bmp|
sib_color_balance|Processing@400/Image Processing/@100|||
sib_color_hls_adjust|Processing@400/Image Processing/@100|HLS Adjust||
rgba_keyer|Processing@400/Image Processing/@100|RGBA Keyer|Im_Pro_Keyer.bmp|
mib_color_intensity|Processing@400/Image Processing/@100|Intensity|Im_Pro_Intensity.bmp|
sib_color_invert|Processing@400/Image Processing/@100|Invert|Im_Pro_Invert.bmp|
sib_scalar_invert|Processing@400/Image Processing/@100|Scalar Invert|Im_Pro_Scal_Invert.bmp|
XSIColorMixer|Processing@400/Mixers/@100||Mixer.bmp|
sib_color_gradient|Processing@400/Mixers/@100|Gradient|gradien.bmp|
sitoon_node_mix|Processing@400/Mixers/@100|Toon Mix|Mixer.bmp|
sib_color_2mix|Processing@400/Mixers/@200|Mix 2 Colors|Mixer.bmp|
sib_color_8mix|Processing@400/Mixers/@200|Mix 8 Colors|Mixer.bmp|
sib_boolean_to_color|Processing@400/Conversion/@100|||
sib_color_to_boolean|Processing@400/Conversion/@200||CV_Color_Boolean.bmp|
sib_color_to_scalar|Processing@400/Conversion/@200||CV_Color_Scalar.bmp|
sib_color_to_scalars|Processing@400/Conversion/@200||CV_Color_Scalar.bmp|
sib_color_to_vector|Processing@400/Conversion/@200||CV_Color_Vector.bmp|
sib_color_rgb_to_hsv|Processing@400/Conversion/@220||CV_Rgb_hsv.bmp|
sib_color_hsv_to_rgb|Processing@400/Conversion/@220||CV_Hsv_rgb.bmp|
sib_integer_to_color|Processing@400/Conversion/@300|||
sib_integer_to_scalar|Processing@400/Conversion/@300||CV_Integer_Scalar.bmp|
sib_scalar_to_boolean|Processing@400/Conversion/@400||CV_Scalar_Boolean.bmp|
sib_scalar_to_color|Processing@400/Conversion/@400||CV_Scalar_Color.bmp|
sib_scalar_to_integer|Processing@400/Conversion/@400||CV_Scalar_Integer.bmp|
sib_scalars_to_vector|Processing@400/Conversion/@400||CV_Scalar_Vector.bmp|
sib_vector_to_color|Processing@400/Conversion/@500||CV_Vector_Color.bmp|
sib_vector_to_scalar|Processing@400/Conversion/@500||CV_Vector_Scalar.bmp|
sib_vector_to_scalars|Processing@400/Conversion/@500||CV_Vector_Scalar.bmp|
sib_space_conversion|Processing@400/Conversion/@500|Vector Coordinate Convertor|CV_Vector_Coord.bmp|
sib_dielectric_ior|Processing@400/Raytracing/@100||RayTrace.bmp|
mib_opacity|Processing@400/Raytracing/@100|Opaque|RayTrace.bmp|
mib_photon_basic|Processing@400/Raytracing/@100|Photon|RayTrace.bmp|
sib_illum_photon|Processing@400/Raytracing/@100|Photon Render Tree|RayTrace.bmp|
mib_reflect|Processing@400/Raytracing/@100|Reflection|RayTrace.bmp|
sib_diffuse_reflection|Processing@400/Raytracing/@100|Reflection Diffuse|RayTrace.bmp|
mib_refract|Processing@400/Raytracing/@100|Refraction|RayTrace.bmp|
sib_diffuse_refraction_phen|Processing@400/Raytracing/@100|Refraction Diffuse|RayTrace.bmp|
sib_transparency|Processing@400/Raytracing/@100||RayTrace.bmp|
sib_color_math_basic|Processing@400/Math/@100||Math.bmp|M
sib_color_math_curve|Processing@400/Math/@100||Math.bmp|M
sib_color_math_exponent|Processing@400/Math/@100||Math.bmp|M
sib_color_inrange|Processing@400/Math/@100||Math.bmp|M
sib_color_math_logic|Processing@400/Math/@100||Math.bmp|M
sib_color_math_unary|Processing@400/Math/@100||Math.bmp|M
sib_color_smoothrange|Processing@400/Math/@100||Math.bmp|M
mib_color_average|Processing@400/Math/@100|Color Average|Math.bmp|
sib_scalar_math_basic|Processing@400/Math/@200||Math.bmp|M
sib_scalar_math_curve|Processing@400/Math/@200||Math.bmp|M
sib_scalar_math_exponent|Processing@400/Math/@200||Math.bmp|M
sib_scalar_inrange|Processing@400/Math/@200||Math.bmp|M
sib_scalar_math_logic|Processing@400/Math/@200||Math.bmp|M
sib_scalar_math_unary|Processing@400/Math/@200||Math.bmp|M
sib_scalar_smoothrange|Processing@400/Math/@200||Math.bmp|M
BA_fast_math|Processing@400/Math/@200||Math.bmp|M
sib_interp_linear|Processing@400/Math/@200||Math.bmp|M
sib_atten_exp|Processing@400/Math/@250|Exponent Falloff|Math.bmp|
sib_atten_linear|Processing@400/Math/@250|Linear Falloff|Math.bmp|
sib_boolean_math_logic|Processing@400/Math/@300||Math.bmp|M
sib_boolean_negate|Processing@400/Math/@300||Math.bmp|M
sib_vector_math_scalar|Processing@400/Math/@400||Math.bmp|M
sib_vector_math_vector|Processing@400/Math/@400||Math.bmp|M
mib_twosided|Processing@400/Switch/@100|Front-Back Switch|Switch.bmp|
sib_color_rayswitch|Processing@400/Switch/@100|Ray Type Switch|Switch.bmp|
sib_color_switch|Processing@400/Switch/@200|Color Switch|Switch.bmp|
sib_scalar_switch|Processing@400/Switch/@200||Switch.bmp|
sib_vector_switch|Processing@400/Switch/@200||Switch.bmp|
sib_color_multi_switch|Processing@400/Switch/@300||Switch.bmp|
sib_scalar_multi_switch|Processing@400/Switch/@300||Switch.bmp|
sib_vector_multi_switch|Processing@400/Switch/@300||Switch.bmp|
mib_texture_checkerboard|Texture Generators@500/@100||checker.bmp|T
mib_texture_polkadot|Texture Generators@500/@100||2D_Dot.bmp|T
sib_texture2d_fabric|Texture Generators@500/@100||fabric.bmp|T
sib_texture2d_grid|Texture Generators@500/@100||grid.bmp|T
txt2d-image|Texture Generators@500/@100|Image Implicit|Image_Lookup.bmp|
sib_texture2d_ripple|Texture Generators@500/@100||ripple.bmp|T
sib_texture2d_terrain|Texture Generators@500/@100||terrain.bmp|T
sib_texture_cell|Texture Generators@500/@200||cell.bmp|T
sib_texture_cloud|Texture Generators@500/@200||cloud.bmp|T
sib_texture_flagstone|Texture Generators@500/@200||flagstone.bmp|T
sib_texture_fractal|Texture Generators@500/@200||fractal.bmp|T
sib_texture_lattice|Texture Generators@500/@200||3d_lattice.bmp|T
sib_texture_marble|Texture Generators@500/@200||marble.bmp|T
sib_texture_rock|Texture Generators@500/@200||rock.bmp|T
sib_texture_snow|Texture Generators@500/@200||snow.bmp|T
mib_texture_turbulence|Texture Generators@500/@200||3d_turbulance.bmp|T
sib_texture_vein|Texture Generators@500/@200||vein.bmp|T
mib_texture_wave|Texture Generators@500/@200||3d_wave.bmp|T
sib_texture_wood|Texture Generators@500/@200||wood.bmp|T
sib_texture3Dwarp|Texture Space Controllers@500||Text_Spc_Ctrlr.bmp|
sib_txt2dremap_kalid|Texture Space Controllers@500||Text_Spc_Ctrlr.bmp|
mib_texture_remap|Texture Space Controllers@500|Edit UV|Text_Spc_Ctrlr.bmp|
mib_texture_vector|Texture Space Generators@500|Texture Space Generator|Text_Spc_Gen.bmp|
sib_texproj_lookup|Texture Space Generators@500||Text_Spc_Gen.bmp|
`;

export const SHADER_CATEGORY_ROWS: ShaderCategoryRow[] = TABLE.trim().split('\n').map(line => {
  const [shader, category, displayName, thumbnail, strip] = line.split('|');
  return { shader, category, displayName, thumbnail, strip: strip as ShaderCategoryRow['strip'] };
});
