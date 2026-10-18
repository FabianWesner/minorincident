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
	vec2 nodeUniform18;
	float nodeUniform15;
	float nodeUniform16;
	float nodeUniform19;
	float nodeUniform14;
	vec3 nodeUniform34;
	float nodeUniform35;
	float nodeUniform39;
	float nodeUniform46;
	float nodeUniform40;
	float nodeUniform43;
	float nodeUniform44;
	float nodeUniform53;
	float nodeUniform56;
	float nodeUniform57;
	mat4 cameraProjectionMatrix;
	mat4 cameraViewMatrix;
	vec3 nodeUniform45;
	vec3 nodeUniform36;
	float nodeUniform41;
	float nodeUniform23;
	vec3 nodeUniform42;
	vec3 nodeUniform38;
	vec3 nodeUniform37;
	vec3 nodeUniform55;
	vec3 nodeUniform54;
	vec2 nodeUniform59;
	float nodeUniform60;
	float nodeUniform61;
	vec2 nodeUniform26;
	float nodeUniform27;
	float nodeUniform29;
	float nodeUniform65;
	float nodeUniform64;
	vec2 nodeUniform63;
	vec3 nodeUniform62;
	float nodeUniform51;
	vec3 nodeUniform49;
	float nodeUniform48;
	vec3 nodeUniform47;
	float nodeUniform31;
	vec3 nodeUniform30;
	vec3 nodeUniform9;
	vec3 nodeUniform11;
	vec3 nodeUniform12;
	vec3 nodeUniform10;
	vec3 nodeUniform7;
	vec3 nodeUniform8;
	vec2 nodeUniform17;
	vec2 nodeUniform20;
	vec4 nodeUniform58;
};

layout( std140 ) uniform object {
	vec3 nodeUniform0;
	float nodeUniform1;
	vec3 nodeUniform2;
	float nodeUniform3;
	mat3 nodeUniform5;
	mat4 nodeUniform13;
	float nodeUniform22;
	uint nodeUniform24;
	uint nodeUniform28;
};


// varyings
vec4 v_modelViewProjection;
out vec3 v_positionView;
vec3 positionLocal;
out vec3 v_positionWorld;
out vec3 v_positionViewDirection;
vec4 VERTEX_v_modelViewProjection;
out vec3 v_normalViewGeometry;
out vec3 nodeVarying7;
out vec3 nodeVarying8;


// attributes
layout( location = 0 ) in vec3 normal;
layout( location = 1 ) in vec3 position;
layout( location = 2 ) in vec4 color;


// vars
vec3 normalLocal;
mat4 modelViewMatrix;
vec4 VERTEX_nodeVar51;

// codes


void main() {

	// transforms
	

	// flow
	// code

	normalLocal = normal;
	v_normalViewGeometry = normalize( ( cameraViewMatrix * vec4( ( nodeUniform5 * normalLocal ), 0.0 ) ).xyz );
	positionLocal = position;
	v_positionWorld = ( nodeUniform13 * vec4( positionLocal, 1.0 ) ).xyz;
	modelViewMatrix = ( cameraViewMatrix * nodeUniform13 );
	v_positionView = ( modelViewMatrix * vec4( positionLocal, 1.0 ) ).xyz;
	nodeVarying7 = color.xyz;
	nodeVarying8 = position;
	v_positionViewDirection = ( - v_positionView );
	VERTEX_nodeVar51 = ( cameraProjectionMatrix * vec4( v_positionView, 1.0 ) );
	VERTEX_v_modelViewProjection = VERTEX_nodeVar51;

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

layout( std140 ) uniform object {
	vec3 nodeUniform0;
	float nodeUniform1;
	vec3 nodeUniform2;
	float nodeUniform3;
	mat3 nodeUniform5;
	mat4 nodeUniform13;
	float nodeUniform22;
	uint nodeUniform24;
	uint nodeUniform28;
};

layout( std140 ) uniform render {
	vec2 nodeUniform18;
	float nodeUniform15;
	float nodeUniform16;
	float nodeUniform19;
	float nodeUniform14;
	vec3 nodeUniform34;
	float nodeUniform35;
	float nodeUniform39;
	float nodeUniform46;
	float nodeUniform40;
	float nodeUniform43;
	float nodeUniform44;
	float nodeUniform53;
	float nodeUniform56;
	float nodeUniform57;
	mat4 cameraProjectionMatrix;
	mat4 cameraViewMatrix;
	vec3 nodeUniform45;
	vec3 nodeUniform36;
	float nodeUniform41;
	float nodeUniform23;
	vec3 nodeUniform42;
	vec3 nodeUniform38;
	vec3 nodeUniform37;
	vec3 nodeUniform55;
	vec3 nodeUniform54;
	vec2 nodeUniform59;
	float nodeUniform60;
	float nodeUniform61;
	vec2 nodeUniform26;
	float nodeUniform27;
	float nodeUniform29;
	float nodeUniform65;
	float nodeUniform64;
	vec2 nodeUniform63;
	vec3 nodeUniform62;
	float nodeUniform51;
	vec3 nodeUniform49;
	float nodeUniform48;
	vec3 nodeUniform47;
	float nodeUniform31;
	vec3 nodeUniform30;
	vec3 nodeUniform9;
	vec3 nodeUniform11;
	vec3 nodeUniform12;
	vec3 nodeUniform10;
	vec3 nodeUniform7;
	vec3 nodeUniform8;
	vec2 nodeUniform17;
	vec2 nodeUniform20;
	vec4 nodeUniform58;
};

layout( std140 ) uniform palette {
	float nodeUniform67;
	float nodeUniform32;
	float nodeUniform66;
	float nodeUniform33;
	float nodeUniform52;
	float nodeUniform50;
};
uniform sampler2D nodeUniform21;
uniform sampler2D nodeUniform25;

// varyings
in vec3 v_positionView;
in vec3 v_positionWorld;
in vec3 v_positionViewDirection;
in vec3 v_normalViewGeometry;
in vec3 nodeVarying7;
in vec3 nodeVarying8;


// vars
vec4 DiffuseColor;
vec3 EmissiveColor;
vec4 Output;
vec3 directDiffuse;
vec3 normalViewGeometry;
vec3 NORMAL_normalView;
vec3 normalView;
vec3 nodeVar0;
vec4 nodeVar1;
vec4 nodeVar2;
vec3 nodeVar3;
vec3 nodeVar4;
float nodeVar5;
vec3 nodeVar6;
vec3 nodeVar7;
vec3 nodeVar8;
vec3 nodeVar9;
vec3 irradiance;
vec3 normalWorld;
float nodeVar10;
float nodeVar11;
float nodeVar12;
vec3 nodeVar13;
vec3 nodeVar14;
vec3 indirectDiffuse;
vec4 nodeVar15;
vec4 nodeVar16;
vec4 nodeVar17;
float ambientOcclusion;
vec3 nodeVar18;
vec3 totalDiffuse;
vec3 nodeVar19;
vec3 totalSpecular;
vec3 directSpecular;
vec3 indirectSpecular;
vec3 nodeVar20;
vec3 outgoingLight;
vec3 nodeVar21;
float nodeVar22;
float nodeVar23;
float nodeVar24;
vec2 nodeVar25;
vec2 nodeVar26;
bool nodeVar27;
vec2 nodeVar28;
vec4 nodeVar29;
vec3 nodeVar30;
vec3 nodeVar31;
vec2 nodeVar32;
vec2 nodeVar33;
vec2 nodeVar34;
bool nodeVar35;
vec2 nodeVar36;
vec4 nodeVar37;
vec3 nodeVar38;
float nodeVar39;
float nodeVar40;
float nodeVar41;
float nodeVar42;
float nodeVar43;
float nodeVar44;
float nodeVar45;
vec3 nodeVar46;
vec3 positionViewDirection;
vec3 nodeVar47;
vec3 nodeVar48;
vec2 nodeVar49;
float nodeVar50;

// codes


void main() {

	// flow
	// code

	DiffuseColor = vec4( nodeUniform0, 1.0 );
	DiffuseColor.w = ( DiffuseColor.w * nodeUniform1 );
	DiffuseColor.w = 1.0;
	EmissiveColor = ( nodeUniform2 * vec3( nodeUniform3 ) );
	directDiffuse = vec3( 0.0, 0.0, 0.0 );
	normalViewGeometry = normalize( v_normalViewGeometry );
	NORMAL_normalView = ( normalViewGeometry * vec3( ( ( float( gl_FrontFacing ) * 2.0 ) - 1.0 ) ) );
	normalView = NORMAL_normalView;
	nodeVar0 = ( nodeUniform7 - nodeUniform8 );
	nodeVar1 = vec4( nodeVar0, 0.0 );
	nodeVar2 = ( cameraViewMatrix * nodeVar1 );
	nodeVar3 = normalize( nodeVar2.xyz );
	nodeVar4 = nodeVar3;
	nodeVar5 = dot( normalView, nodeVar4 );
	nodeVar6 = ( vec3( clamp( nodeVar5, 0.0, 1.0 ) ) * nodeUniform9 );
	nodeVar7 = ( DiffuseColor.xyz * vec3( 0.3183098861837907 ) );
	nodeVar8 = ( nodeVar6 * nodeVar7 );
	nodeVar9 = ( directDiffuse + nodeVar8 );
	directDiffuse = nodeVar9;
	irradiance = vec3( 0.0, 0.0, 0.0 );
	normalWorld = normalize( ( vec4( normalView, 0.0 ) * cameraViewMatrix ).xyz );
	nodeVar10 = dot( normalWorld, normalize( nodeUniform12 ) );
	nodeVar11 = ( nodeVar10 * 0.5 );
	nodeVar12 = ( nodeVar11 + 0.5 );
	nodeVar13 = mix( nodeUniform10, nodeUniform11, nodeVar12 );
	nodeVar14 = ( irradiance + nodeVar13 );
	irradiance = nodeVar14;
	indirectDiffuse = vec3( 0.0, 0.0, 0.0 );
	nodeVar15 = ( DiffuseColor * vec4( 0.3183098861837907 ) );
	nodeVar16 = ( vec4( irradiance, 1.0 ) * nodeVar15 );
	nodeVar17 = ( vec4( indirectDiffuse, 1.0 ) + nodeVar16 );
	indirectDiffuse = nodeVar17.xyz;
	ambientOcclusion = 1.0;
	nodeVar18 = ( indirectDiffuse * vec3( ambientOcclusion ) );
	indirectDiffuse = nodeVar18;
	nodeVar19 = ( directDiffuse + indirectDiffuse );
	totalDiffuse = nodeVar19;
	directSpecular = vec3( 0.0, 0.0, 0.0 );
	indirectSpecular = vec3( 0.0, 0.0, 0.0 );
	nodeVar20 = ( directSpecular + indirectSpecular );
	totalSpecular = nodeVar20;
	nodeVar21 = ( totalDiffuse + totalSpecular );
	outgoingLight = nodeVar21;
	Output = max( vec4( ( outgoingLight + EmissiveColor ), DiffuseColor.w ), 0.0 );

	if ( ( v_positionWorld.y > ( nodeUniform14 + 0.08 ) ) ) {


		if ( ( v_positionView.z > nodeUniform15 ) ) {

			nodeVar23 = smoothstep( ( nodeUniform16 * 0.85 ), ( nodeUniform16 * 1.0 ), length( ( ( ( vec2( gl_FragCoord.xy.x, nodeUniform17.y - gl_FragCoord.xy.y ) / nodeUniform17 ) - nodeUniform18 ) * vec2( ( nodeUniform17.x / nodeUniform17.y ), 1.0 ) ) ) );

		} else {

			nodeVar23 = 1.0;

		}

		nodeVar22 = mix( 1.0, nodeVar23, nodeUniform19 );

	} else {

		nodeVar22 = 1.0;

	}


	if ( ( ! ( nodeVar22 > fract( ( fract( dot( floor( vec2( gl_FragCoord.xy.x, nodeUniform20.y - gl_FragCoord.xy.y ) ), vec2( 0.06711056, 0.00583715 ) ) ) * 52.9829189 ) ) ) ) ) {

		discard;
		

	}


	if ( ( nodeUniform22 < 0.0 ) ) {

		nodeVar24 = 120.0;

	} else {

		nodeVar24 = ( nodeUniform23 * 120.0 );

	}

	nodeVar25 = vec2( ( ( ( nodeUniform22 + nodeVar24 ) + 0.5 ) / 240.0 ), 0.5 );
	nodeVar27 = bool( nodeUniform24 );

	if ( nodeVar27 ) {

		nodeVar28 = nodeVar25;
		nodeVar26 = vec2( nodeVar28.x, 1.0 - nodeVar28.y );

	} else {

		nodeVar26 = nodeVar25;

	}

	nodeVar29 = texture( nodeUniform21, nodeVar26 );
	nodeVar30 = ( nodeVar29.xyz * nodeVarying7 );
	nodeVar31 = vec3( 0.0, 0.0, 0.0 );
	nodeVar32 = ( ( v_positionWorld.xz - nodeUniform26 ) / vec2( nodeUniform27 ) );
	nodeVar33 = ( nodeVar32 + vec2( 0.5 ) );
	nodeVar35 = bool( nodeUniform28 );

	if ( nodeVar35 ) {

		nodeVar36 = nodeVar33;
		nodeVar34 = vec2( nodeVar36.x, 1.0 - nodeVar36.y );

	} else {

		nodeVar34 = nodeVar33;

	}

	nodeVar37 = texture( nodeUniform25, nodeVar34 );
	nodeVar38 = ( ( ( ( nodeVar37.xyz * vec3( smoothstep( 0.5, 0.42, max( abs( nodeVar32 ), abs( nodeVar32.yx ) ).x ) ) ) * vec3( clamp( ( 1.0 - ( v_positionWorld.y / 5.0 ) ), 0.15, 1.0 ) ) ) * vec3( nodeUniform29 ) ) * vec3( ( ( normalWorld.y * 0.35 ) + 0.65 ) ) );
	nodeVar39 = 1.0;
	nodeVar31 = mix( nodeVar38, mix( ( ( vec3( dot( nodeVar38, vec3( 0.2126, 0.7152, 0.0722 ) ) ) * nodeUniform30 ) * vec3( 0.3 ) ), nodeVar38, nodeVar39 ), nodeUniform31 );
	nodeVar40 = 0.0;
	nodeVar41 = ( ( sqrt( clamp( nodeUniform32, 0.0, 1.0 ) ) * 0.09 ) + 0.02 );
	nodeVar42 = length( ( ( nodeVarying8.yz - vec2( 0.07, 0.09 ) ) * vec2( 1.0, 1.3 ) ) );
	nodeVar43 = length( ( ( nodeVarying8.yz - vec2( -0.1, -0.06 ) ) * vec2( 1.0, 1.3 ) ) );
	nodeVar44 = length( ( ( nodeVarying8.yz - vec2( -0.16, 0.15 ) ) * vec2( 1.0, 1.3 ) ) );

	if ( ( nodeUniform32 > 0.0 ) ) {

		nodeVar45 = 1.0;

	} else {

		nodeVar45 = 0.0;

	}

	nodeVar46 = mix( mix( nodeVar30, vec3( 0.450785782828426, 0.006048833020386069, 0.013702083043526807 ), ( max( max( ( 1.0 - smoothstep( ( nodeVar41 * 1.0 ), ( ( nodeVar41 * 1.0 ) + max( ( fwidth( nodeVar42 ) * 1.5 ), 0.006 ) ), nodeVar42 ) ), ( 1.0 - smoothstep( ( nodeVar41 * 0.7 ), ( ( nodeVar41 * 0.7 ) + max( ( fwidth( nodeVar43 ) * 1.5 ), 0.006 ) ), nodeVar43 ) ) ), ( 1.0 - smoothstep( ( nodeVar41 * 0.5 ), ( ( nodeVar41 * 0.5 ) + max( ( fwidth( nodeVar44 ) * 1.5 ), 0.006 ) ), nodeVar44 ) ) ) * nodeVar45 ) ), vec3( 0.012286488353353374, 0.010329823026364548, 0.009134058699157796 ), nodeUniform33 );
	positionViewDirection = normalize( v_positionViewDirection );
	nodeVar47 = ( ( mix( ( ( mix( nodeVar46, nodeUniform34, ( ( smoothstep( -0.2, 1.0, ( - normalWorld.y ) ) * pow( max( ( 1.0 - ( max( v_positionWorld.y, 0.0 ) / 2.0 ) ), 0.0 ), 2.0 ) ) * nodeUniform35 ) ) * ( nodeUniform36 + ( ( mix( nodeUniform37, nodeUniform38, ( ( normalWorld.y * 0.5 ) + 0.5 ) ) * vec3( nodeUniform39 ) ) * vec3( ( nodeUniform40 * 2.0 ) ) ) ) ) * vec3( nodeUniform41 ) ), ( nodeVar46 * nodeUniform42 ), ( clamp( max( smoothstep( nodeUniform43, nodeUniform44, dot( normalWorld, nodeUniform45 ) ), ( 1.0 - nodeVar39 ) ), 0.0, 1.0 ) * nodeUniform46 ) ) + ( nodeVar46 * ( ( nodeVar31 + ( nodeUniform47 * vec3( ( ( nodeVar40 * nodeUniform48 ) * ( ( normalWorld.y * 0.3 ) + 0.7 ) ) ) ) ) + ( ( ( nodeUniform49 * vec3( nodeUniform50 ) ) * vec3( nodeUniform51 ) ) * vec3( 0.9 ) ) ) ) ) + ( nodeUniform49 * vec3( ( ( smoothstep( 0.62, 0.95, ( 1.0 - clamp( dot( normalView, positionViewDirection ), 0.0, 1.0 ) ) ) * max( nodeVar40, nodeUniform52 ) ) * nodeUniform51 ) ) ) );
	nodeVar48 = mix( ( mix( vec3( dot( nodeVar47, vec3( 0.2126, 0.7152, 0.0722 ) ) ), nodeVar47, nodeUniform53 ) + vec3( 0.0 ) ), mix( nodeUniform54, nodeUniform55, smoothstep( nodeUniform56, nodeUniform57, length( ( ( ( vec2( gl_FragCoord.xy.x, nodeUniform20.y - gl_FragCoord.xy.y ) - nodeUniform58.xy ) / nodeUniform58.zw ) - nodeUniform59 ) ) ) ), smoothstep( nodeUniform60, nodeUniform61, ( - v_positionView.z ) ) );
	nodeVar49 = ( v_positionWorld.xz - nodeUniform62.xz );
	nodeVar50 = length( nodeVar49 );
	nodeVar48 = mix( nodeVar48, mix( ( ( vec3( dot( nodeVar48, vec3( 0.2126, 0.7152, 0.0722 ) ) ) * vec3( 0.38 ) ) + vec3( 0.006 ) ), nodeVar48, max( max( ( ( smoothstep( 0.78, 0.92, ( dot( nodeVar49, nodeUniform63 ) / max( nodeVar50, 0.01 ) ) ) * smoothstep( 18.0, 14.0, nodeVar50 ) ) * nodeUniform64 ), smoothstep( 2.4, 0.8, nodeVar50 ) ), max( smoothstep( 0.15, 0.8, dot( nodeVar31, vec3( 0.2126, 0.7152, 0.0722 ) ) ), 0.0 ) ) ), nodeUniform65 );
	nodeVar48 = ( nodeVar48 + vec3( nodeUniform66 ) );

	// result
	fragColor = vec4( nodeVar48, ( nodeUniform67 * 1.0 ) );

}
