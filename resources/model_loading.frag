#version 330 core
out vec4 FragColor;

in vec2 TexCoords;

in vec3 FragPos;
in vec3 FragNormal;

uniform sampler2D texture_diffuse1;
uniform sampler2D roughness_map1;
uniform sampler2D normal_map1;

uniform vec3 viewPos; 

vec3 Uncharted2Tonemap(vec3 x) {
    float Brightness = 0.28;
    x*= Brightness;
    float A = 0.28;
    float B = 0.29;        
    float C = 0.10;
    float D = 0.2;
    float E = 0.025;
    float F = 0.35;
    return ((x*(A*x+C*B)+D*E)/(x*(A*x+B)+D*F))-E/F;
}

vec3 unchartedTonemapping(vec3 color)
{

    float gamma = 2.2;
    vec3 curr = Uncharted2Tonemap(color*4.7);
    color = pow(curr/Uncharted2Tonemap(vec3(15.2)),vec3(1.0/gamma));
    //color = pow(curr,vec3(1.0/gamma));
    
    return color;
}

//https://github.com/TheRealMJP/BakingLab/blob/master/BakingLab/ACES.hlsl
/*
=================================================================================================

  Baking Lab
  by MJP and David Neubelt
  http://mynameismjp.wordpress.com/

  All code licensed under the MIT license

=================================================================================================
 The code in this file was originally written by Stephen Hill (@self_shadow), who deserves all
 credit for coming up with this fit and implementing it. Buy him a beer next time you see him. :)
*/

// sRGB => XYZ => D65_2_D60 => AP1 => RRT_SAT
mat3x3 ACESInputMat = mat3x3
(
    0.59719, 0.35458, 0.04823,
    0.07600, 0.90834, 0.01566,
    0.02840, 0.13383, 0.83777
);

// ODT_SAT => XYZ => D60_2_D65 => sRGB
mat3x3 ACESOutputMat = mat3x3
(
     1.60475, -0.53108, -0.07367,
    -0.10208,  1.10813, -0.00605,
    -0.00327, -0.07276,  1.07602
);

vec3 RRTAndODTFit(vec3 v)
{
    vec3 a = v * (v + 0.0245786f) - 0.000090537f;
    vec3 b = v * (0.983729f * v + 0.4329510f) + 0.238081f;
    return a / b;
}

vec3 ACESFitted(vec3 color)
{
    color = transpose(ACESInputMat) * color;
    // Apply RRT and ODT
    color = RRTAndODTFit(color);
    color = transpose(ACESOutputMat) * color;
    color = clamp(color, 0, 1);
    return color;
}

//https://learnopengl.com/PBR/Lighting
const float PI = 3.14159265359;

float distributionGGX (vec3 N, vec3 H, float roughness){
	float a2    = roughness * roughness * roughness * roughness;
	float NdotH = max (dot (N, H), 0.0);
	float denom = (NdotH * NdotH * (a2 - 1.0) + 1.0);
	return a2 / (PI * denom * denom);
}

float geometrySchlickGGX (float NdotV, float roughness){
	float r = (roughness + 1.0);
	float k = (r * r) / 8.0;
	return NdotV / (NdotV * (1.0 - k) + k);
}

float geometrySmith (vec3 N, vec3 V, vec3 L, float roughness){
	return geometrySchlickGGX (max (dot (N, L), 0.0), roughness) * 
		   geometrySchlickGGX (max (dot (N, V), 0.0), roughness);
}

vec3 fresnelSchlick (float cosTheta, vec3 F0){
	return F0 + (1.0 - F0) * pow (1.0 - cosTheta, 5.0);
}


//L is vector towards light (normalize(lightPositions - WorldPos))
//V is the view vector, from world pos, camera (normalize(camPos - WorldPos))
vec3 PBR(vec3 N, vec3 V, vec3 L, vec3 albedo, vec3 lightColor,
	float roughness, float metallic)
{
	vec3 H = normalize (V + L);

	 // Cook-Torrance BRDF
	 vec3  F0 = mix (vec3 (0.04), albedo, metallic);
	 float NDF = distributionGGX(N, H, roughness);
	 float G   = geometrySmith(N, V, L, roughness);
	 vec3  F   = fresnelSchlick(max(dot(H, V), 0.0), F0);        
	 vec3  kD  = vec3(1.0) - F;
	 kD *= 1.0 - metallic;	  
	 
	 vec3  numerator   = NDF * G * F;
	 float denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0);
	 vec3  specular    = numerator / max(denominator, 0.001);  
		 
	 float NdotL = max(dot(N, L), 0.0);                
	 vec3  color = lightColor * (kD * albedo / PI + specular) * NdotL; 
	 //color /= lightAentuation; light atenuation can go here

	 return color;
}


//https://gamedev.stackexchange.com/questions/22204/from-normal-to-rotation-matrix#:~:text=Therefore%2C%20if%20you%20want%20to,the%20first%20and%20second%20columns.
mat3x3 NormalToRotation(in vec3 normal)
{
	// Find a vector in the plane
	vec3 tangent0 = cross(normal, vec3(1, 0, 0));
	if (dot(tangent0, tangent0) < 0.001)
		tangent0 = cross(normal, vec3(0, 1, 0));
	tangent0 = normalize(tangent0);
	// Find another vector in the plane
	vec3 tangent1 = normalize(cross(normal, tangent0));
	// Construct a 3x3 matrix by storing three vectors in the columns of the matrix
	return mat3x3(tangent0,tangent1,normal);
	//return ColumnVectorsToMatrix(tangent0, tangent1, normal);
}


void main()
{    

vec3 lightPos = vec3(1.0, 7.0, 1.0); 
vec3 lightDir = normalize(lightPos - FragPos); 
vec3 lightColor = vec3(3.0); 
vec4 texColor = texture(texture_diffuse1, TexCoords);
texColor.rgb = pow(texColor.rgb, vec3(2.2));

vec3 L = normalize(lightPos - FragPos);  
vec3 V = normalize(viewPos - FragPos);  
vec3 N = normalize(FragNormal);  

vec3 normal = texture(normal_map1, TexCoords).rgb;
normal = normalize(2*normal - 1.f);
mat3 rotMat = NormalToRotation(FragNormal);
normal = rotMat * normal;
normal = normalize(normal);
N = normal; 


vec3 mr = texture(roughness_map1, TexCoords).rgb;
    float metallic = mr.b;
    float roughness = max(mr.g, 0.01);
    float ao = mr.r;

vec3 finalColor = PBR( N,  V,  L, texColor.rgb, lightColor,
	 roughness, metallic);
finalColor += ao * 0.05 * texColor.rgb; 
FragColor = vec4(ACESFitted(finalColor * 1.2), texColor.a); 
FragColor.rgb = pow(FragColor.rgb, vec3(1/2.2));


}