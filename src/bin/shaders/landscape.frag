#version 330

/*
The main program uploads a xy-plane aligned unit square of texture coordinate. The square is
then transformed to travel at some direction away from origin.

uniform offset 
    is there for randomness
uniform scale
    tells the size in pixels of the smallest side of the window. This is the size of one unit in
    texture space.
    used to determine the highest frequency
*/

in vec3 texpos;
out vec4 Target0;

uniform float u_Scale;

// For random independent runs
// uniform vec3 offset;

// Hash function: http://amindforeverprogramming.blogspot.com/2013/07/random-floats-in-glsl-330.html
uint hash( uint x ) {
    x += ( x << 10u );
    x ^= ( x >>  6u );
    x += ( x <<  3u );
    x ^= ( x >> 11u );
    x += ( x << 15u );
    return x;
}
uint hash( uvec3 v ) {
    return hash( v.x ^ hash(v.y) ^ hash(v.z) );
}
float random( uvec3 pos ) {
    const uint mantissaMask = 0x007FFFFFu;
    const uint one          = 0x3F800000u;
   
    uint h = hash( pos );
    h &= mantissaMask;
    h |= one;
    
    float  r2 = uintBitsToFloat( h );
    return r2 - 1.0;
}
float random( vec3 pos)
{
    return random( floatBitsToUint(pos));
}
float separate(float n, out float i) // returns fraction part
{
    float frac = modf(n, i);
    if (n < 0.f) {
        frac = 1 + frac; // make fraction non-negative and invert (1 - frac)
        i --;
    }
    return frac;
}

// Perlin: http://www.iquilezles.org/www/articles/morenoise/morenoise.htm
float perlin(vec3 pos, out float dnx, out float dny, out float dnz)
{
    float i, j, k;
    float u, v, w;

    // Separate integer and fractional part of coordinates
    u = separate( pos.x, i);
    v = separate( pos.y, j);
    w = separate( pos.z, k);


    float du = 30.0f*u*u*(u*(u-2.0f)+1.0f);
    float dv = 30.0f*v*v*(v*(v-2.0f)+1.0f);
    float dw = 30.0f*w*w*(w*(w-2.0f)+1.0f);

    u = u*u*u*(u*(u*6.0f-15.0f)+10.0f);
    v = v*v*v*(v*(v*6.0f-15.0f)+10.0f);
    w = w*w*w*(w*(w*6.0f-15.0f)+10.0f);

    float a = random( vec3(i+0, j+0, k+0) );
    float b = random( vec3(i+1, j+0, k+0) );
    float c = random( vec3(i+0, j+1, k+0) );
    float d = random( vec3(i+1, j+1, k+0) );
    float e = random( vec3(i+0, j+0, k+1) );
    float f = random( vec3(i+1, j+0, k+1) );
    float g = random( vec3(i+0, j+1, k+1) );
    float h = random( vec3(i+1, j+1, k+1) );

    float k0 =   a;
    float k1 =   b - a;
    float k2 =   c - a;
    float k3 =   e - a;
    float k4 =   a - b - c + d;
    float k5 =   a - c - e + g;
    float k6 =   a - b - e + f;
    float k7 = - a + b + c - d + e - f - g + h;

    /* dnx = du * (k1 + k4*v + k6*w + k7*v*w); */
    /* dny = dv * (k2 + k5*w + k4*u + k7*w*u); */
    /* dnz = dw * (k3 + k6*u + k5*v + k7*u*v); */
    return k0 + k1*u + k2*v + k3*w + k4*u*v + k5*v*w + k6*w*u + k7*u*v*w;
}

float FBM(vec3 pos, int octaves)
{
    float a, b, c;
    float result = 0;
    float p;

    pos *= u_Scale; // Frequency = pixel

    const float power = 2; // Higher -> lower frequencies dominate. Normal: 2
    float pos_factor = 1.f;
    float strength_factor = 1.f / pow(power, octaves);
    for (int i = 0; i < octaves; i ++)
    {
        p = perlin(pos * pos_factor, a, b, c );
        result += (power - 1) * strength_factor * p;

        pos_factor *= 0.5f;
        strength_factor *= power;
    }

    /* return abs(result); // would work if you convert to scale [-1, 1] */
    return result;
}

vec3 colorScale(float val)
{
    if ( val > 1) return vec3(1,0,1);
    const vec3 col1 = vec3(0, 0, 20) / 255.0f; // Dark water
    const vec3 col2 = vec3(34, 111, 110) / 255.0f; // Water
    const vec3 col3 = vec3(132, 121, 84) / 255.0f; // Sand
    const vec3 col4 = vec3(47, 115, 33) / 255.0f; // Forest
    const vec3 col5 = vec3(8, 49, 8) / 255.0f; // Dark forest
    const vec3 col6 = vec3(0.16f, 0.16f, 0.16f);
    const vec3 col7 = vec3(1); // Mountain
    const float ch1 = 0.27f;
    const float ch2 = 0.3f;
    const float ch3 = 0.31f;
    const float ch4 = 0.65f;
 
    if (val < ch1) {
        return mix(col1, col2, val/ch1);
    } else if (val < ch2) {
        return mix(col2, col3, (val - ch1)/(ch2 - ch1));
    } else if (val < ch3) {
        return mix(col3, col4, (val - ch2)/(ch3 - ch2));
    } else if (val < ch4) {
        return mix(col4, col5, (val - ch3)/(ch4 - ch3));
    } else {
        return mix(col6, col7, (val - ch4)/(1.f - ch4));
    }
}

vec3 gamma(vec3 col) {
    vec3 low = col / 12.92;
    vec3 high = pow((col + 0.055) / 1.055, vec3(2.4));

    return mix(low, high, step(vec3(0.04045), col));
}

void main()
{
    int freq = 9;
    float r;
    r = FBM(texpos, freq);
    vec3 col = gamma(vec3(colorScale(r)));
    Target0 = vec4(col, 1);
}
