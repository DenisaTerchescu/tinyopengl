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


void main()
{    
   // FragColor = texture(texture_diffuse1, TexCoords);

      // outColor = texture(texSampler, fragTexCoord);

vec3 lightPos = vec3(1.0, 5.0, 1.0); 
vec3 lightDir = normalize(lightPos - FragPos); 
vec3 lightColor = vec3(1.0, 0.75, 0.8)*3; 
vec3 objectColor = vec3(0.0, 1.0, 0.0);
vec4 texColor = texture(normal_map1, TexCoords);
texColor.rgb = pow(texColor.rgb, vec3(2.2));
objectColor = pow(objectColor, vec3(2.2));

// ambient light
vec3 ambientColor = vec3(0.1, 0.1, 0.1);

// diffuse light
float diff = max(dot(FragNormal, lightDir), 0.0);
vec3 diffuseLighting = diff * lightColor;



// specular light
float specularStrength = 10.0;
vec3 viewDir = normalize(viewPos - FragPos);
// vec3 reflectDir = reflect(-lightDir, fragNormal); // Phong

vec3 halfwayDir = normalize(lightDir + viewDir); // Blinn-Phong
float spec = pow(max(dot(FragNormal, halfwayDir), 0.0), 64.0);

//float spec = pow(max(dot(viewDir, reflectDir), 0.0), 64);
if (diff <= 0) { spec = 0;}
vec3 specular = specularStrength * spec * lightColor;  

//vec3 finalColor = (diffuseLighting + ambientColor + specular) * objectColor;
vec3 finalColor = (diffuseLighting + ambientColor + specular) * texColor.rgb;
FragColor  = vec4(ACESFitted(finalColor * 0.7), texColor.a); 
FragColor .rgb = pow(FragColor.rgb, vec3(1/2.2)); 
}