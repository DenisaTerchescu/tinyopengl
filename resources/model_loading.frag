#version 330 core
out vec4 FragColor;

in vec2 TexCoords;

in vec3 FragPos;
in vec3 FragNormal;

uniform sampler2D texture_diffuse1;
uniform vec3 viewPos; 

void main()
{    
    FragColor = texture(texture_diffuse1, TexCoords);
}