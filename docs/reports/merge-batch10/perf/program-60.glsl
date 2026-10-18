#version 300 es

// Three.js r186 - Node System


// extensions


// precision

precision highp float;
precision highp int;
precision highp sampler2D;
precision highp sampler3D;
precision highp samplerCube;
precision highp sampler2DArray;

precision highp usampler2D;
precision highp usampler3D;
precision highp usamplerCube;
precision highp usampler2DArray;

precision highp isampler2D;
precision highp isampler3D;
precision highp isamplerCube;
precision highp isampler2DArray;

precision highp sampler2DShadow;
precision highp sampler2DArrayShadow;
precision highp samplerCubeShadow;


// structs





// uniforms

layout( std140 ) uniform render {
	vec3 nodeUniform40;
	float nodeUniform41;
	float nodeUniform45;
	float nodeUniform52;
	float nodeUniform46;
	float nodeUniform49;
	float nodeUniform50;
	float nodeUniform59;
	float nodeUniform63;
	float nodeUniform64;
	mat4 cameraProjectionMatrix;
	mat4 cameraViewMatrix;
	vec3 nodeUniform51;
	vec3 nodeUniform42;
	float nodeUniform47;
	vec3 nodeUniform48;
	vec3 nodeUniform44;
	vec3 nodeUniform43;
	vec3 nodeUniform62;
	vec3 nodeUniform61;
	vec2 nodeUniform66;
	float nodeUniform67;
	float nodeUniform68;
	vec2 nodeUniform32;
	float nodeUniform33;
	float nodeUniform35;
	float nodeUniform72;
	float nodeUniform71;
	vec2 nodeUniform70;
	vec3 nodeUniform69;
	float nodeUniform57;
	vec3 nodeUniform55;
	float nodeUniform54;
	vec3 nodeUniform53;
	float nodeUniform37;
	vec3 nodeUniform36;
	vec3 nodeUniform10;
	vec3 nodeUniform29;
	vec3 nodeUniform30;
	vec3 nodeUniform28;
	vec3 nodeUniform8;
	vec3 nodeUniform9;
	mat4 nodeUniform12;
	float nodeUniform13;
	float nodeUniform14;
	float nodeUniform27;
	vec2 nodeUniform0;
	vec4 nodeUniform65;
};

layout( std140 ) uniform object {
	vec3 nodeUniform1;
	float nodeUniform2;
	vec3 nodeUniform3;
	float nodeUniform4;
	mat3 nodeUniform6;
	mat4 nodeUniform11;
	float nodeUniform16;
	vec2 nodeUniform17;
	uint nodeUniform18;
	uint nodeUniform19;
	uint nodeUniform20;
	uint nodeUniform21;
	uint nodeUniform22;
	uint nodeUniform23;
	uint nodeUniform24;
	uint nodeUniform25;
	uint nodeUniform26;
	uint nodeUniform34;
};


// varyings
vec3 positionLocal;
vec4 v_modelViewProjection;
out vec3 v_positionView;
out vec3 v_positionWorld;
out vec3 crowdAppearanceColor;
out vec3 v_positionViewDirection;
vec4 VERTEX_v_modelViewProjection;
out vec3 v_normalViewGeometry;
out vec3 vInstanceColor;
out vec4 nodeVarying9;
out vec3 nodeVarying10;
out vec3 nodeVarying11;
out vec4 nodeVarying12;


// attributes
layout( location = 0 ) in vec3 position;
layout( location = 1 ) in vec4 _placement0;
layout( location = 2 ) in vec4 _placement1;
layout( location = 3 ) in vec4 _placement2;
layout( location = 4 ) in vec4 _placement3;
layout( location = 5 ) in vec3 normal;
layout( location = 6 ) in vec3 _placementColor;
layout( location = 7 ) in vec4 _state;
layout( location = 8 ) in vec4 _parts;
layout( location = 9 ) in vec4 _variant;
layout( location = 10 ) in vec3 color;


// vars
mat4 nodeVar0;
vec3 normalLocal;
vec3 nodeVar86;
vec3 nodeVar87;
float nodeVar88;
vec3 nodeVar89;
vec3 nodeVar90;
vec3 nodeVar91;
vec3 nodeVar92;
vec3 nodeVar93;
vec3 nodeVar94;
float nodeVar95;
vec3 nodeVar96;
vec3 nodeVar97;
vec3 nodeVar98;
vec3 nodeVar99;
vec3 nodeVar100;
vec3 nodeVar101;
vec3 nodeVar102;
vec3 nodeVar103;
vec3 nodeVar104;
vec3 nodeVar105;
vec3 nodeVar106;
vec3 nodeVar107;
float nodeVar108;
vec3 nodeVar109;
vec3 nodeVar110;
vec3 nodeVar111;
vec3 nodeVar112;
vec3 nodeVar113;
vec3 nodeVar114;
vec3 nodeVar115;
vec3 nodeVar116;
float nodeVar117;
vec3 nodeVar118;
vec3 nodeVar119;
vec3 nodeVar120;
vec3 nodeVar121;
vec3 nodeVar122;
vec3 nodeVar123;
vec3 nodeVar124;
vec3 nodeVar125;
float nodeVar126;
vec3 nodeVar127;
vec3 nodeVar128;
vec3 nodeVar129;
vec3 nodeVar130;
vec3 nodeVar131;
vec3 nodeVar132;
vec3 nodeVar133;
mat4 modelViewMatrix;
vec4 VERTEX_nodeVar155;

// codes


void main() {

	// transforms
	

	// flow
	// code

	positionLocal = position;
	nodeVar0 = mat4( _placement0, _placement1, _placement2, _placement3 );
	positionLocal = ( nodeVar0 * vec4( positionLocal, 1.0 ) ).xyz;
	normalLocal = normal;
	normalLocal = normalize( ( transpose( inverse( mat3( nodeVar0[ 0 ].xyz, nodeVar0[ 1 ].xyz, nodeVar0[ 2 ].xyz ) ) ) * normalLocal ) );
	vInstanceColor = _placementColor;
	positionLocal = positionLocal;
	nodeVarying9 = _state;
	v_normalViewGeometry = normalize( ( cameraViewMatrix * vec4( ( nodeUniform6 * normalLocal ), 0.0 ) ).xyz );
	v_positionWorld = ( nodeUniform11 * vec4( positionLocal, 1.0 ) ).xyz;

	if ( ( _parts.y == -1.0 ) ) {

		nodeVar88 = mod( floor( ( _variant.y / 2.0 ) ), 6.0 );

		if ( ( nodeVar88 == 5.0 ) ) {

			nodeVar87 = vec3( 0.1499597898006365, 0.19806931954941637, 0.12477181755144427 );

		} else {


			if ( ( nodeVar88 == 4.0 ) ) {

				nodeVar89 = vec3( 0.19461783043107173, 0.24620132669705552, 0.15292615198613213 );

			} else {


				if ( ( nodeVar88 == 3.0 ) ) {

					nodeVar90 = vec3( 0.24620132669705552, 0.2874408377161099, 0.181164244239483 );

				} else {


					if ( ( nodeVar88 == 2.0 ) ) {

						nodeVar91 = vec3( 0.28314874041918053, 0.33245153633549385, 0.21223075740342198 );

					} else {


						if ( ( nodeVar88 == 1.0 ) ) {

							nodeVar92 = vec3( 0.3712376804636741, 0.4178850708380236, 0.2704977910022518 );

						} else {

							nodeVar92 = vec3( 0.4286904966038916, 0.4793201830913402, 0.3231432091022285 );

						}

						nodeVar91 = nodeVar92;

					}

					nodeVar90 = nodeVar91;

				}

				nodeVar89 = nodeVar90;

			}

			nodeVar87 = nodeVar89;

		}

		nodeVar86 = ( nodeVar87 * vec3( clamp( ( dot( color, vec3( 0.2126, 0.7152, 0.0722 ) ) / 0.35 ), 0.65, 1.2 ) ) );

	} else {


		if ( ( _parts.y == -4.0 ) ) {

			nodeVar95 = mod( floor( ( _variant.z / 16.0 ) ), 12.0 );

			if ( ( nodeVar95 == 11.0 ) ) {

				nodeVar94 = vec3( 0.061246054224174035, 0.171441100722554, 0.07421356837213867 );

			} else {


				if ( ( nodeVar95 == 10.0 ) ) {

					nodeVar96 = vec3( 0.14702726648767014, 0.08228270712149792, 0.20155625378383743 );

				} else {


					if ( ( nodeVar95 == 9.0 ) ) {

						nodeVar97 = vec3( 0.3049873140591091, 0.2663556047920505, 0.1878207722902346 );

					} else {


						if ( ( nodeVar95 == 8.0 ) ) {

							nodeVar98 = vec3( 0.09989872823822872, 0.12213877222015301, 0.20863687013464577 );

						} else {


							if ( ( nodeVar95 == 7.0 ) ) {

								nodeVar99 = vec3( 0.48514994004665124, 0.09758734713304495, 0.12213877222015301 );

							} else {


								if ( ( nodeVar95 == 6.0 ) ) {

									nodeVar100 = vec3( 0.06480326668529614, 0.15592646369776456, 0.14126329113044458 );

								} else {


									if ( ( nodeVar95 == 5.0 ) ) {

										nodeVar101 = vec3( 0.41254261347374327, 0.19461783043107173, 0.28314874041918053 );

									} else {


										if ( ( nodeVar95 == 4.0 ) ) {

											nodeVar102 = vec3( 0.3915724777393922, 0.13286832154414627, 0.059511238155621766 );

										} else {


											if ( ( nodeVar95 == 3.0 ) ) {

												nodeVar103 = vec3( 0.1912016827303171, 0.23839757380151394, 0.10461648408208657 );

											} else {


												if ( ( nodeVar95 == 2.0 ) ) {

													nodeVar104 = vec3( 0.6583748172725346, 0.4178850708380236, 0.031896033067374104 );

												} else {


													if ( ( nodeVar95 == 1.0 ) ) {

														nodeVar105 = vec3( 0.7835377915215659, 0.6938717612856897, 0.48514994004665124 );

													} else {

														nodeVar105 = vec3( 0.030713443727452196, 0.1878207722902346, 0.41254261347374327 );

													}

													nodeVar104 = nodeVar105;

												}

												nodeVar103 = nodeVar104;

											}

											nodeVar102 = nodeVar103;

										}

										nodeVar101 = nodeVar102;

									}

									nodeVar100 = nodeVar101;

								}

								nodeVar99 = nodeVar100;

							}

							nodeVar98 = nodeVar99;

						}

						nodeVar97 = nodeVar98;

					}

					nodeVar96 = nodeVar97;

				}

				nodeVar94 = nodeVar96;

			}

			nodeVar93 = ( color * nodeVar94 );

		} else {


			if ( ( _parts.y == -5.0 ) ) {

				nodeVar108 = mod( floor( ( _variant.x / 2.0 ) ), 8.0 );

				if ( ( nodeVar108 == 7.0 ) ) {

					nodeVar107 = vec3( 0.38642943377667954, 0.3515325994898463, 0.36130677977297226 );

				} else {


					if ( ( nodeVar108 == 6.0 ) ) {

						nodeVar109 = vec3( 0.46207699964472876, 0.14702726648767014, 0.05612849004241121 );

					} else {


						if ( ( nodeVar108 == 5.0 ) ) {

							nodeVar110 = vec3( 0.1878207722902346, 0.04666508633021928, 0.025186859622305935 );

						} else {


							if ( ( nodeVar108 == 4.0 ) ) {

								nodeVar111 = vec3( 0.6375968739867731, 0.407240211891531, 0.16202937562896222 );

							} else {


								if ( ( nodeVar108 == 3.0 ) ) {

									nodeVar112 = vec3( 0.35640014413537763, 0.15292615198613213, 0.054480276435339814 );

								} else {


									if ( ( nodeVar108 == 2.0 ) ) {

										nodeVar113 = vec3( 0.16202937562896222, 0.059511238155621766, 0.031896033067374104 );

									} else {


										if ( ( nodeVar108 == 1.0 ) ) {

											nodeVar114 = vec3( 0.06662593863608139, 0.02955683443236377, 0.02028856305209031 );

										} else {

											nodeVar114 = vec3( 0.01764195448412081, 0.013702083043526807, 0.014443843592229466 );

										}

										nodeVar113 = nodeVar114;

									}

									nodeVar112 = nodeVar113;

								}

								nodeVar111 = nodeVar112;

							}

							nodeVar110 = nodeVar111;

						}

						nodeVar109 = nodeVar110;

					}

					nodeVar107 = nodeVar109;

				}

				nodeVar106 = ( color * nodeVar107 );

			} else {


				if ( ( _parts.y == -2.0 ) ) {

					nodeVar117 = mod( floor( ( _variant.x / 2.0 ) ), 8.0 );

					if ( ( nodeVar117 == 7.0 ) ) {

						nodeVar116 = vec3( 0.38642943377667954, 0.3515325994898463, 0.36130677977297226 );

					} else {


						if ( ( nodeVar117 == 6.0 ) ) {

							nodeVar118 = vec3( 0.46207699964472876, 0.14702726648767014, 0.05612849004241121 );

						} else {


							if ( ( nodeVar117 == 5.0 ) ) {

								nodeVar119 = vec3( 0.1878207722902346, 0.04666508633021928, 0.025186859622305935 );

							} else {


								if ( ( nodeVar117 == 4.0 ) ) {

									nodeVar120 = vec3( 0.6375968739867731, 0.407240211891531, 0.16202937562896222 );

								} else {


									if ( ( nodeVar117 == 3.0 ) ) {

										nodeVar121 = vec3( 0.35640014413537763, 0.15292615198613213, 0.054480276435339814 );

									} else {


										if ( ( nodeVar117 == 2.0 ) ) {

											nodeVar122 = vec3( 0.16202937562896222, 0.059511238155621766, 0.031896033067374104 );

										} else {


											if ( ( nodeVar117 == 1.0 ) ) {

												nodeVar123 = vec3( 0.06662593863608139, 0.02955683443236377, 0.02028856305209031 );

											} else {

												nodeVar123 = vec3( 0.01764195448412081, 0.013702083043526807, 0.014443843592229466 );

											}

											nodeVar122 = nodeVar123;

										}

										nodeVar121 = nodeVar122;

									}

									nodeVar120 = nodeVar121;

								}

								nodeVar119 = nodeVar120;

							}

							nodeVar118 = nodeVar119;

						}

						nodeVar116 = nodeVar118;

					}

					nodeVar115 = ( nodeVar116 * vec3( clamp( ( dot( color, vec3( 0.2126, 0.7152, 0.0722 ) ) / 0.12 ), 0.65, 1.3 ) ) );

				} else {


					if ( ( _parts.y == -3.0 ) ) {

						nodeVar126 = mod( floor( ( _variant.z / 2.0 ) ), 8.0 );

						if ( ( nodeVar126 == 7.0 ) ) {

							nodeVar125 = vec3( 0.1499597898006365, 0.14702726648767014, 0.12743768042608497 );

						} else {


							if ( ( nodeVar126 == 6.0 ) ) {

								nodeVar127 = vec3( 0.05126945836711539, 0.04373502925049377, 0.04373502925049377 );

							} else {


								if ( ( nodeVar126 == 5.0 ) ) {

									nodeVar128 = vec3( 0.10461648408208657, 0.06480326668529614, 0.11193242782769693 );

								} else {


									if ( ( nodeVar126 == 4.0 ) ) {

										nodeVar129 = vec3( 0.03954623527052923, 0.06662593863608139, 0.05612849004241121 );

									} else {


										if ( ( nodeVar126 == 3.0 ) ) {

											nodeVar130 = vec3( 0.23074004851362043, 0.171441100722554, 0.09989872823822872 );

										} else {


											if ( ( nodeVar126 == 2.0 ) ) {

												nodeVar131 = vec3( 0.11193242782769693, 0.08228270712149792, 0.059511238155621766 );

											} else {


												if ( ( nodeVar126 == 1.0 ) ) {

													nodeVar132 = vec3( 0.08021982030622662, 0.09989872823822872, 0.1499597898006365 );

												} else {

													nodeVar132 = vec3( 0.036889450395083165, 0.054480276435339814, 0.08650046202808521 );

												}

												nodeVar131 = nodeVar132;

											}

											nodeVar130 = nodeVar131;

										}

										nodeVar129 = nodeVar130;

									}

									nodeVar128 = nodeVar129;

								}

								nodeVar127 = nodeVar128;

							}

							nodeVar125 = nodeVar127;

						}

						nodeVar124 = ( nodeVar125 * vec3( clamp( ( dot( color, vec3( 0.2126, 0.7152, 0.0722 ) ) / 0.1 ), 0.65, 1.25 ) ) );

					} else {


						if ( ( _parts.y > 0.0 ) ) {

							nodeVar133 = ( mod( _variant.xyz, vec3( 2.0 ) ) * vec3( _parts.y ) );

						} else {

							nodeVar133 = color;

						}

						nodeVar124 = nodeVar133;

					}

					nodeVar115 = nodeVar124;

				}

				nodeVar106 = nodeVar115;

			}

			nodeVar93 = nodeVar106;

		}

		nodeVar86 = nodeVar93;

	}

	crowdAppearanceColor = nodeVar86;
	nodeVarying10 = position;
	modelViewMatrix = ( cameraViewMatrix * nodeUniform11 );
	v_positionView = ( modelViewMatrix * vec4( positionLocal, 1.0 ) ).xyz;
	v_positionViewDirection = ( - v_positionView );
	nodeVarying11 = color;
	nodeVarying12 = _parts;
	VERTEX_nodeVar155 = ( cameraProjectionMatrix * vec4( v_positionView, 1.0 ) );
	VERTEX_v_modelViewProjection = VERTEX_nodeVar155;

	// result
	gl_Position = VERTEX_v_modelViewProjection;

	gl_PointSize = 1.0;

}

#version 300 es

// Three.js r186 - Node System


// extensions


// precision

precision highp float;
precision highp int;
precision highp sampler2D;
precision highp sampler3D;
precision highp samplerCube;
precision highp sampler2DArray;

precision highp usampler2D;
precision highp usampler3D;
precision highp usamplerCube;
precision highp usampler2DArray;

precision highp isampler2D;
precision highp isampler3D;
precision highp isamplerCube;
precision highp isampler2DArray;

precision highp sampler2DShadow;
precision highp sampler2DArrayShadow;
precision highp samplerCubeShadow;


// structs

layout( location = 0 ) out vec4 fragColor;



// uniforms

layout( std140 ) uniform render {
	vec3 nodeUniform40;
	float nodeUniform41;
	float nodeUniform45;
	float nodeUniform52;
	float nodeUniform46;
	float nodeUniform49;
	float nodeUniform50;
	float nodeUniform59;
	float nodeUniform63;
	float nodeUniform64;
	mat4 cameraProjectionMatrix;
	mat4 cameraViewMatrix;
	vec3 nodeUniform51;
	vec3 nodeUniform42;
	float nodeUniform47;
	vec3 nodeUniform48;
	vec3 nodeUniform44;
	vec3 nodeUniform43;
	vec3 nodeUniform62;
	vec3 nodeUniform61;
	vec2 nodeUniform66;
	float nodeUniform67;
	float nodeUniform68;
	vec2 nodeUniform32;
	float nodeUniform33;
	float nodeUniform35;
	float nodeUniform72;
	float nodeUniform71;
	vec2 nodeUniform70;
	vec3 nodeUniform69;
	float nodeUniform57;
	vec3 nodeUniform55;
	float nodeUniform54;
	vec3 nodeUniform53;
	float nodeUniform37;
	vec3 nodeUniform36;
	vec3 nodeUniform10;
	vec3 nodeUniform29;
	vec3 nodeUniform30;
	vec3 nodeUniform28;
	vec3 nodeUniform8;
	vec3 nodeUniform9;
	mat4 nodeUniform12;
	float nodeUniform13;
	float nodeUniform14;
	float nodeUniform27;
	vec2 nodeUniform0;
	vec4 nodeUniform65;
};

layout( std140 ) uniform object {
	vec3 nodeUniform1;
	float nodeUniform2;
	vec3 nodeUniform3;
	float nodeUniform4;
	mat3 nodeUniform6;
	mat4 nodeUniform11;
	float nodeUniform16;
	vec2 nodeUniform17;
	uint nodeUniform18;
	uint nodeUniform19;
	uint nodeUniform20;
	uint nodeUniform21;
	uint nodeUniform22;
	uint nodeUniform23;
	uint nodeUniform24;
	uint nodeUniform25;
	uint nodeUniform26;
	uint nodeUniform34;
};

layout( std140 ) uniform palette {
	float nodeUniform74;
	float nodeUniform60;
	float nodeUniform38;
	float nodeUniform73;
	float nodeUniform39;
	float nodeUniform58;
	float nodeUniform56;
};
uniform sampler2DShadow nodeUniform15;
uniform sampler2D nodeUniform31;

// varyings
in vec3 v_positionView;
in vec3 v_positionWorld;
in vec3 crowdAppearanceColor;
in vec3 v_positionViewDirection;
in vec3 v_normalViewGeometry;
in vec3 vInstanceColor;
in vec4 nodeVarying9;
in vec3 nodeVarying10;
in vec3 nodeVarying11;
in vec4 nodeVarying12;


// vars
vec2 nodeVar1;
vec2 nodeVar2;
vec4 DiffuseColor;
vec3 EmissiveColor;
vec4 Output;
vec3 directDiffuse;
vec3 normalViewGeometry;
vec3 NORMAL_normalView;
vec3 normalView;
vec3 nodeVar3;
vec4 nodeVar4;
vec4 nodeVar5;
vec3 nodeVar6;
vec3 nodeVar7;
float nodeVar8;
vec3 shadowPositionWorld;
float nodeVar9;
float nodeVar10;
vec3 normalWorld;
vec4 nodeVar11;
vec3 nodeVar12;
vec3 nodeVar13;
vec2 nodeVar14;
vec2 nodeVar15;
vec2 nodeVar16;
vec2 nodeVar17;
bool nodeVar18;
vec2 nodeVar19;
float nodeVar20;
vec2 nodeVar21;
vec2 nodeVar22;
vec2 nodeVar23;
bool nodeVar24;
vec2 nodeVar25;
float nodeVar26;
vec2 nodeVar27;
vec2 nodeVar28;
vec2 nodeVar29;
bool nodeVar30;
vec2 nodeVar31;
float nodeVar32;
vec2 nodeVar33;
vec2 nodeVar34;
vec2 nodeVar35;
bool nodeVar36;
vec2 nodeVar37;
float nodeVar38;
vec2 nodeVar39;
vec2 nodeVar40;
vec2 nodeVar41;
bool nodeVar42;
vec2 nodeVar43;
float nodeVar44;
vec2 nodeVar45;
vec2 nodeVar46;
vec2 nodeVar47;
bool nodeVar48;
vec2 nodeVar49;
float nodeVar50;
vec2 nodeVar51;
vec2 nodeVar52;
vec2 nodeVar53;
bool nodeVar54;
vec2 nodeVar55;
float nodeVar56;
vec2 nodeVar57;
vec2 nodeVar58;
vec2 nodeVar59;
bool nodeVar60;
vec2 nodeVar61;
float nodeVar62;
vec2 nodeVar63;
vec2 nodeVar64;
vec2 nodeVar65;
bool nodeVar66;
vec2 nodeVar67;
float nodeVar68;
float nodeVar69;
vec3 nodeVar70;
vec3 nodeVar71;
vec3 nodeVar72;
vec3 nodeVar73;
vec3 irradiance;
float nodeVar74;
float nodeVar75;
float nodeVar76;
vec3 nodeVar77;
vec3 nodeVar78;
vec3 indirectDiffuse;
vec4 nodeVar79;
vec4 nodeVar80;
vec4 nodeVar81;
float ambientOcclusion;
vec3 nodeVar82;
vec3 totalDiffuse;
vec3 nodeVar83;
vec3 totalSpecular;
vec3 directSpecular;
vec3 indirectSpecular;
vec3 nodeVar84;
vec3 outgoingLight;
vec3 nodeVar85;
vec3 nodeVar134;
vec3 nodeVar135;
vec2 nodeVar136;
vec2 nodeVar137;
vec2 nodeVar138;
bool nodeVar139;
vec2 nodeVar140;
vec4 nodeVar141;
vec3 nodeVar142;
float nodeVar143;
float nodeVar144;
float nodeVar145;
float nodeVar146;
float nodeVar147;
float nodeVar148;
vec3 nodeVar149;
vec3 positionViewDirection;
vec3 nodeVar150;
vec3 nodeVar151;
vec3 nodeVar152;
vec2 nodeVar153;
float nodeVar154;

// codes


void main() {

	// flow
	// code

	nodeVar1 = floor( vec2( gl_FragCoord.xy.x, nodeUniform0.y - gl_FragCoord.xy.y ) );
	nodeVar2 = floor( ( nodeVar1 / vec2( 2.0 ) ) );

	if ( ( ! ( ( 1.0 - ( floor( ( nodeVarying9.w / 2.0 ) ) / 255.0 ) ) > ( ( ( ( mod( ( ( mod( nodeVar1.x, 2.0 ) * 2.0 ) + ( mod( nodeVar1.y, 2.0 ) * 3.0 ) ), 4.0 ) * 4.0 ) + mod( ( ( mod( nodeVar2.x, 2.0 ) * 2.0 ) + ( mod( nodeVar2.y, 2.0 ) * 3.0 ) ), 4.0 ) ) + 0.5 ) / 16.0 ) ) ) ) {

		discard;
		

	}

	DiffuseColor = vec4( ( vInstanceColor * nodeUniform1 ), 1.0 );
	DiffuseColor.w = ( DiffuseColor.w * nodeUniform2 );
	DiffuseColor.w = 1.0;
	EmissiveColor = ( nodeUniform3 * vec3( nodeUniform4 ) );
	directDiffuse = vec3( 0.0, 0.0, 0.0 );
	normalViewGeometry = normalize( v_normalViewGeometry );
	NORMAL_normalView = ( normalViewGeometry * vec3( ( ( float( gl_FrontFacing ) * 2.0 ) - 1.0 ) ) );
	normalView = NORMAL_normalView;
	nodeVar3 = ( nodeUniform8 - nodeUniform9 );
	nodeVar4 = vec4( nodeVar3, 0.0 );
	nodeVar5 = ( cameraViewMatrix * nodeVar4 );
	nodeVar6 = normalize( nodeVar5.xyz );
	nodeVar7 = nodeVar6;
	nodeVar8 = dot( normalView, nodeVar7 );
	shadowPositionWorld = v_positionWorld;
	nodeVar9 = 1.0;
	normalWorld = normalize( ( vec4( normalView, 0.0 ) * cameraViewMatrix ).xyz );
	nodeVar11 = ( nodeUniform12 * vec4( ( shadowPositionWorld + ( normalWorld * vec3( nodeUniform13 ) ) ), 1.0 ) );
	nodeVar12 = ( nodeVar11.xyz / vec3( nodeVar11.w ) );
	nodeVar13 = vec3( nodeVar12.x, ( 1.0 - nodeVar12.y ), ( nodeVar12.z + nodeUniform14 ) );

	if ( ( ( ( ( ( nodeVar13.x >= 0.0 ) && ( nodeVar13.x <= 1.0 ) ) && ( nodeVar13.y >= 0.0 ) ) && ( nodeVar13.y <= 1.0 ) ) && ( nodeVar13.z <= 1.0 ) ) ) {

		nodeVar14 = ( vec2( nodeUniform16 ) / nodeUniform17 );
		nodeVar15 = ( nodeVar13.xy + ( vec2( -1.0, -1.0 ) * nodeVar14 ) );
		nodeVar16 = nodeVar15;
		nodeVar18 = bool( nodeUniform18 );

		if ( nodeVar18 ) {

			nodeVar19 = nodeVar16;
			nodeVar17 = vec2( nodeVar19.x, 1.0 - nodeVar19.y );

		} else {

			nodeVar17 = nodeVar16;

		}

		nodeVar20 = texture( nodeUniform15, vec3( nodeVar17, nodeVar13.z ) );
		nodeVar21 = ( nodeVar13.xy + ( vec2( -1.0, 0.0 ) * nodeVar14 ) );
		nodeVar22 = nodeVar21;
		nodeVar24 = bool( nodeUniform19 );

		if ( nodeVar24 ) {

			nodeVar25 = nodeVar22;
			nodeVar23 = vec2( nodeVar25.x, 1.0 - nodeVar25.y );

		} else {

			nodeVar23 = nodeVar22;

		}

		nodeVar26 = texture( nodeUniform15, vec3( nodeVar23, nodeVar13.z ) );
		nodeVar27 = ( nodeVar13.xy + ( vec2( -1.0, 1.0 ) * nodeVar14 ) );
		nodeVar28 = nodeVar27;
		nodeVar30 = bool( nodeUniform20 );

		if ( nodeVar30 ) {

			nodeVar31 = nodeVar28;
			nodeVar29 = vec2( nodeVar31.x, 1.0 - nodeVar31.y );

		} else {

			nodeVar29 = nodeVar28;

		}

		nodeVar32 = texture( nodeUniform15, vec3( nodeVar29, nodeVar13.z ) );
		nodeVar33 = ( nodeVar13.xy + ( vec2( 0.0, -1.0 ) * nodeVar14 ) );
		nodeVar34 = nodeVar33;
		nodeVar36 = bool( nodeUniform21 );

		if ( nodeVar36 ) {

			nodeVar37 = nodeVar34;
			nodeVar35 = vec2( nodeVar37.x, 1.0 - nodeVar37.y );

		} else {

			nodeVar35 = nodeVar34;

		}

		nodeVar38 = texture( nodeUniform15, vec3( nodeVar35, nodeVar13.z ) );
		nodeVar39 = ( nodeVar13.xy + ( vec2( 0.0, 0.0 ) * nodeVar14 ) );
		nodeVar40 = nodeVar39;
		nodeVar42 = bool( nodeUniform22 );

		if ( nodeVar42 ) {

			nodeVar43 = nodeVar40;
			nodeVar41 = vec2( nodeVar43.x, 1.0 - nodeVar43.y );

		} else {

			nodeVar41 = nodeVar40;

		}

		nodeVar44 = texture( nodeUniform15, vec3( nodeVar41, nodeVar13.z ) );
		nodeVar45 = ( nodeVar13.xy + ( vec2( 0.0, 1.0 ) * nodeVar14 ) );
		nodeVar46 = nodeVar45;
		nodeVar48 = bool( nodeUniform23 );

		if ( nodeVar48 ) {

			nodeVar49 = nodeVar46;
			nodeVar47 = vec2( nodeVar49.x, 1.0 - nodeVar49.y );

		} else {

			nodeVar47 = nodeVar46;

		}

		nodeVar50 = texture( nodeUniform15, vec3( nodeVar47, nodeVar13.z ) );
		nodeVar51 = ( nodeVar13.xy + ( vec2( 1.0, -1.0 ) * nodeVar14 ) );
		nodeVar52 = nodeVar51;
		nodeVar54 = bool( nodeUniform24 );

		if ( nodeVar54 ) {

			nodeVar55 = nodeVar52;
			nodeVar53 = vec2( nodeVar55.x, 1.0 - nodeVar55.y );

		} else {

			nodeVar53 = nodeVar52;

		}

		nodeVar56 = texture( nodeUniform15, vec3( nodeVar53, nodeVar13.z ) );
		nodeVar57 = ( nodeVar13.xy + ( vec2( 1.0, 0.0 ) * nodeVar14 ) );
		nodeVar58 = nodeVar57;
		nodeVar60 = bool( nodeUniform25 );

		if ( nodeVar60 ) {

			nodeVar61 = nodeVar58;
			nodeVar59 = vec2( nodeVar61.x, 1.0 - nodeVar61.y );

		} else {

			nodeVar59 = nodeVar58;

		}

		nodeVar62 = texture( nodeUniform15, vec3( nodeVar59, nodeVar13.z ) );
		nodeVar63 = ( nodeVar13.xy + ( vec2( 1.0, 1.0 ) * nodeVar14 ) );
		nodeVar64 = nodeVar63;
		nodeVar66 = bool( nodeUniform26 );

		if ( nodeVar66 ) {

			nodeVar67 = nodeVar64;
			nodeVar65 = vec2( nodeVar67.x, 1.0 - nodeVar67.y );

		} else {

			nodeVar65 = nodeVar64;

		}

		nodeVar68 = texture( nodeUniform15, vec3( nodeVar65, nodeVar13.z ) );
		nodeVar10 = ( ( ( ( ( ( ( ( ( 0.0 + ( nodeVar20 * 0.0625 ) ) + ( nodeVar26 * 0.125 ) ) + ( nodeVar32 * 0.0625 ) ) + ( nodeVar38 * 0.125 ) ) + ( nodeVar44 * 0.25 ) ) + ( nodeVar50 * 0.125 ) ) + ( nodeVar56 * 0.0625 ) ) + ( nodeVar62 * 0.125 ) ) + ( nodeVar68 * 0.0625 ) );

	} else {

		nodeVar10 = 1.0;

	}

	nodeVar69 = mix( 1.0, nodeVar10, nodeUniform27 );
	nodeVar9 = ( nodeVar9 * nodeVar69 );
	nodeVar70 = ( vec3( clamp( nodeVar8, 0.0, 1.0 ) ) * ( nodeUniform10 * vec3( 1.0 ) ) );
	nodeVar71 = ( DiffuseColor.xyz * vec3( 0.3183098861837907 ) );
	nodeVar72 = ( nodeVar70 * nodeVar71 );
	nodeVar73 = ( directDiffuse + nodeVar72 );
	directDiffuse = nodeVar73;
	irradiance = vec3( 0.0, 0.0, 0.0 );
	nodeVar74 = dot( normalWorld, normalize( nodeUniform30 ) );
	nodeVar75 = ( nodeVar74 * 0.5 );
	nodeVar76 = ( nodeVar75 + 0.5 );
	nodeVar77 = mix( nodeUniform28, nodeUniform29, nodeVar76 );
	nodeVar78 = ( irradiance + nodeVar77 );
	irradiance = nodeVar78;
	indirectDiffuse = vec3( 0.0, 0.0, 0.0 );
	nodeVar79 = ( DiffuseColor * vec4( 0.3183098861837907 ) );
	nodeVar80 = ( vec4( irradiance, 1.0 ) * nodeVar79 );
	nodeVar81 = ( vec4( indirectDiffuse, 1.0 ) + nodeVar80 );
	indirectDiffuse = nodeVar81.xyz;
	ambientOcclusion = 1.0;
	nodeVar82 = ( indirectDiffuse * vec3( ambientOcclusion ) );
	indirectDiffuse = nodeVar82;
	nodeVar83 = ( directDiffuse + indirectDiffuse );
	totalDiffuse = nodeVar83;
	directSpecular = vec3( 0.0, 0.0, 0.0 );
	indirectSpecular = vec3( 0.0, 0.0, 0.0 );
	nodeVar84 = ( directSpecular + indirectSpecular );
	totalSpecular = nodeVar84;
	nodeVar85 = ( totalDiffuse + totalSpecular );
	outgoingLight = nodeVar85;
	Output = max( vec4( ( outgoingLight + EmissiveColor ), DiffuseColor.w ), 0.0 );
	nodeVar134 = crowdAppearanceColor;
	nodeVar135 = vec3( 0.0, 0.0, 0.0 );
	nodeVar136 = ( ( v_positionWorld.xz - nodeUniform32 ) / vec2( nodeUniform33 ) );
	nodeVar137 = ( nodeVar136 + vec2( 0.5 ) );
	nodeVar139 = bool( nodeUniform34 );

	if ( nodeVar139 ) {

		nodeVar140 = nodeVar137;
		nodeVar138 = vec2( nodeVar140.x, 1.0 - nodeVar140.y );

	} else {

		nodeVar138 = nodeVar137;

	}

	nodeVar141 = texture( nodeUniform31, nodeVar138 );
	nodeVar142 = ( ( ( ( nodeVar141.xyz * vec3( smoothstep( 0.5, 0.42, max( abs( nodeVar136 ), abs( nodeVar136.yx ) ).x ) ) ) * vec3( clamp( ( 1.0 - ( v_positionWorld.y / 5.0 ) ), 0.15, 1.0 ) ) ) * vec3( nodeUniform35 ) ) * vec3( ( ( normalWorld.y * 0.35 ) + 0.65 ) ) );
	nodeVar135 = mix( nodeVar142, mix( ( ( vec3( dot( nodeVar142, vec3( 0.2126, 0.7152, 0.0722 ) ) ) * nodeUniform36 ) * vec3( 0.3 ) ), nodeVar142, nodeVar9 ), nodeUniform37 );
	nodeVar143 = 0.0;
	nodeVar144 = ( ( sqrt( clamp( nodeUniform38, 0.0, 1.0 ) ) * 0.09 ) + 0.02 );
	nodeVar145 = length( ( ( nodeVarying10.yz - vec2( 0.07, 0.09 ) ) * vec2( 1.0, 1.3 ) ) );
	nodeVar146 = length( ( ( nodeVarying10.yz - vec2( -0.1, -0.06 ) ) * vec2( 1.0, 1.3 ) ) );
	nodeVar147 = length( ( ( nodeVarying10.yz - vec2( -0.16, 0.15 ) ) * vec2( 1.0, 1.3 ) ) );

	if ( ( nodeUniform38 > 0.0 ) ) {

		nodeVar148 = 1.0;

	} else {

		nodeVar148 = 0.0;

	}

	nodeVar149 = mix( mix( nodeVar134, vec3( 0.450785782828426, 0.006048833020386069, 0.013702083043526807 ), ( max( max( ( 1.0 - smoothstep( ( nodeVar144 * 1.0 ), ( ( nodeVar144 * 1.0 ) + max( ( fwidth( nodeVar145 ) * 1.5 ), 0.006 ) ), nodeVar145 ) ), ( 1.0 - smoothstep( ( nodeVar144 * 0.7 ), ( ( nodeVar144 * 0.7 ) + max( ( fwidth( nodeVar146 ) * 1.5 ), 0.006 ) ), nodeVar146 ) ) ), ( 1.0 - smoothstep( ( nodeVar144 * 0.5 ), ( ( nodeVar144 * 0.5 ) + max( ( fwidth( nodeVar147 ) * 1.5 ), 0.006 ) ), nodeVar147 ) ) ) * nodeVar148 ) ), vec3( 0.012286488353353374, 0.010329823026364548, 0.009134058699157796 ), nodeUniform39 );
	positionViewDirection = normalize( v_positionViewDirection );
	nodeVar150 = ( ( mix( ( ( mix( nodeVar149, nodeUniform40, ( ( smoothstep( -0.2, 1.0, ( - normalWorld.y ) ) * pow( max( ( 1.0 - ( max( v_positionWorld.y, 0.0 ) / 2.0 ) ), 0.0 ), 2.0 ) ) * nodeUniform41 ) ) * ( nodeUniform42 + ( ( mix( nodeUniform43, nodeUniform44, ( ( normalWorld.y * 0.5 ) + 0.5 ) ) * vec3( nodeUniform45 ) ) * vec3( ( nodeUniform46 * 2.0 ) ) ) ) ) * vec3( nodeUniform47 ) ), ( nodeVar149 * nodeUniform48 ), ( clamp( max( smoothstep( nodeUniform49, nodeUniform50, dot( normalWorld, nodeUniform51 ) ), ( 1.0 - nodeVar9 ) ), 0.0, 1.0 ) * nodeUniform52 ) ) + ( nodeVar149 * ( ( nodeVar135 + ( nodeUniform53 * vec3( ( ( nodeVar143 * nodeUniform54 ) * ( ( normalWorld.y * 0.3 ) + 0.7 ) ) ) ) ) + ( ( ( nodeUniform55 * vec3( nodeUniform56 ) ) * vec3( nodeUniform57 ) ) * vec3( 0.9 ) ) ) ) ) + ( nodeUniform55 * vec3( ( ( smoothstep( 0.62, 0.95, ( 1.0 - clamp( dot( normalView, positionViewDirection ), 0.0, 1.0 ) ) ) * max( nodeVar143, nodeUniform58 ) ) * nodeUniform57 ) ) ) );
	nodeVar151 = ( ( ( ( nodeVarying11 / vec3( max( dot( nodeVarying11, vec3( 0.2126, 0.7152, 0.0722 ) ), 0.25 ) ) ) * vec3( nodeVarying12.z ) ) * vec3( 1.2 ) ) + vec3( mod( nodeVarying9.w, 2.0 ) ) );
	nodeVar152 = mix( ( mix( vec3( dot( nodeVar150, vec3( 0.2126, 0.7152, 0.0722 ) ) ), nodeVar150, nodeUniform59 ) + ( nodeVar151 * vec3( nodeUniform60 ) ) ), mix( nodeUniform61, nodeUniform62, smoothstep( nodeUniform63, nodeUniform64, length( ( ( ( vec2( gl_FragCoord.xy.x, nodeUniform0.y - gl_FragCoord.xy.y ) - nodeUniform65.xy ) / nodeUniform65.zw ) - nodeUniform66 ) ) ) ), smoothstep( nodeUniform67, nodeUniform68, ( - v_positionView.z ) ) );
	nodeVar153 = ( v_positionWorld.xz - nodeUniform69.xz );
	nodeVar154 = length( nodeVar153 );
	nodeVar152 = mix( nodeVar152, mix( ( ( vec3( dot( nodeVar152, vec3( 0.2126, 0.7152, 0.0722 ) ) ) * vec3( 0.38 ) ) + vec3( 0.006 ) ), nodeVar152, max( max( ( ( smoothstep( 0.78, 0.92, ( dot( nodeVar153, nodeUniform70 ) / max( nodeVar154, 0.01 ) ) ) * smoothstep( 18.0, 14.0, nodeVar154 ) ) * nodeUniform71 ), smoothstep( 2.4, 0.8, nodeVar154 ) ), max( smoothstep( 0.15, 0.8, dot( nodeVar135, vec3( 0.2126, 0.7152, 0.0722 ) ) ), smoothstep( 0.05, 0.15, ( dot( nodeVar151, vec3( 0.2126, 0.7152, 0.0722 ) ) * nodeUniform60 ) ) ) ) ), nodeUniform72 );
	nodeVar152 = ( nodeVar152 + vec3( nodeUniform73 ) );

	// result
	fragColor = vec4( nodeVar152, ( nodeUniform74 * 1.0 ) );

}
