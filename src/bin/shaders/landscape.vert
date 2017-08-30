#version 330

in vec2 v_Pos;
in vec3 v_Texpos;
out vec3 texpos;

uniform mat4 u_Transform;

void main()
{
    texpos = (u_Transform * vec4(v_Texpos, 1)).xyz;
    gl_Position = vec4(v_Pos, 0, 1);
}
