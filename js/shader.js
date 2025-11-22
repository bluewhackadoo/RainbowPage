// ============================================================
// WebGL Shader Implementation - Synthwave Sunset
// ============================================================
// This creates an animated 3D synthwave landscape with:
// - Procedural terrain using triangular noise
// - Animated sunset with horizontal bands
// - Stars in the sky
// - Reflective terrain surface
// - Dark blue wireframe grid lines
// ============================================================

// Global variables
let canvas, gl, programInfo, buffers;
let startTime = Date.now();  // Track when animation started
let lastTime = startTime;     // Track last frame time for delta calculation

/**
 * Initialize the WebGL shader and start the animation
 */
function initShader() {
    // Get the canvas element
    canvas = document.getElementById('shaderCanvas');
    
    // Get WebGL context with alpha disabled for opaque background
    gl = canvas.getContext('webgl', { alpha: false, premultipliedAlpha: false }) || 
         canvas.getContext('experimental-webgl', { alpha: false, premultipliedAlpha: false });
    
    if (!gl) {
        console.error('WebGL not supported');
        return;
    }

    // Setup canvas sizing
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // ============================================================
    // VERTEX SHADER
    // ============================================================
    // Simple pass-through vertex shader that creates a full-screen quad
    // covering the entire canvas from -1 to 1 in both x and y
    const vsSource = `
        attribute vec4 aVertexPosition;
        void main() {
            gl_Position = aVertexPosition;
        }
    `;

    // ============================================================
    // FRAGMENT SHADER - Main Scene Rendering
    // ============================================================
    const fsSource = `
        precision highp float;
        
        // Uniforms passed from JavaScript
        uniform vec2 iResolution;   // Canvas resolution (width, height)
        uniform float iTime;        // Time in seconds since start
        uniform float iTimeDelta;   // Time since last frame (for motion blur)
        uniform sampler2D iChannel0; // Audio/texture input (optional)
        
        // ============================================================
        // CONFIGURATION OPTIONS
        // ============================================================
        //#define AA 2                    // Anti-aliasing (uncomment for 2x2 supersampling)
        //#define VAPORWAVE               // Alternative color scheme
        //#define stereo 1.               // Stereo 3D mode (1. = parallel, -1. = cross-eyed)
        #define speed 10.                 // Camera movement speed through scene
        #define wave_thing                // Animated wave effect on terrain
        //#define city                    // Add city buildings to horizon (uncomment to enable)
        
        // Audio visualization support (disabled by default for performance)
        // You can add a sound texture in iChannel0 to turn it into an audio visualizer
        // #define disable_sound_texture_sampling
        
        #ifndef disable_sound_texture_sampling
            #undef speed 
            #define speed 5.              // Lower speed looks better with audio visualization
        #endif
        
        #define audio_vibration_amplitude .125  // How much audio affects terrain height
        
        float jTime;  // Time variable used throughout shader (includes motion blur offset)
        
        
        // ============================================================
        // HELPER FUNCTIONS
        // ============================================================
        
        /**
         * Mirror texture sampling (disabled when not using audio)
         * Creates a mirrored repeat pattern for texture coordinates
         */
        #ifdef disable_sound_texture_sampling
        #define textureMirror(a, b) vec4(0)  // Return black when audio disabled
        #else
        vec4 textureMirror(sampler2D tex, vec2 c){
            vec2 cf = fract(c);
            return texture2D(tex,mix(cf,1.-cf,mod(floor(c),2.)));
        }
        #endif
        
        /**
         * Round function implementations
         * WebGL 1.0 doesn't have built-in round(), so we implement it
         * using floor(x + 0.5) which rounds to nearest integer
         */
        float round(float x) {
            return floor(x + 0.5);
        }
        
        vec2 round(vec2 x) {
            return floor(x + 0.5);
        }
        
        vec3 round(vec3 x) {
            return floor(x + 0.5);
        }
        
        /**
         * Amplitude function for terrain edges
         * Creates smooth falloff at edges of terrain (beyond x=1 and x=8)
         */
        float amp(vec2 p){
            return smoothstep(1.,8.,abs(p.x));   
        }
        
        /**
         * Fast power of 512 using repeated squaring
         * More efficient than pow(a, 512) by doing 9 multiplications
         */
        float pow512(float a){
            a*=a;  // ^2
            a*=a;  // ^4
            a*=a;  // ^8
            a*=a;  // ^16
            a*=a;  // ^32
            a*=a;  // ^64
            a*=a;  // ^128
            a*=a;  // ^256
            return a*a;  // ^512
        }
        
        /**
         * Power of 1.5 (a^1.5)
         * Equivalent to a * sqrt(a)
         */
        float pow1d5(float a){
            return a*sqrt(a);
        }
        
        /**
         * 2D to 1D hash function
         * Converts 2D coordinates to pseudo-random value between 0 and 1
         * Used for procedural noise generation
         */
        float hash21(vec2 co){
            return fract(sin(dot(co.xy,vec2(1.9898,7.233)))*45758.5433);
        }
        /**
         * Enhanced hash function for terrain generation
         * Combines amplitude, waves, and optional audio reactivity
         * Returns a value used to determine terrain height
         */
        float hash(vec2 uv){
            float a = amp(uv);  // Get amplitude based on position
            
            #ifdef wave_thing
            // Create animated wave pattern that moves with time
            float w = a>0.?(1.-.4*pow512(.51+.49*sin((.02*(uv.y+.5*uv.x)-jTime)*2.))):0.;
            #else
            float w=1.;  // No wave animation
            #endif
            
            // Combine hash, amplitude, and wave, optionally subtract audio influence
            return (a>0.?
                a*pow1d5(
                //texture(iChannel0,uv/iChannelResolution[0].xy).r  // Audio texture (commented out)
                hash21(uv)  // Use procedural hash instead
                )*w
                :0.)-(textureMirror(iChannel0,vec2((uv.x*29.+uv.y)*.03125,1.)).x)*audio_vibration_amplitude;
        }
        
        /**
         * Calculate minimum edge distance for grid lines
         * Creates the wireframe effect by finding distance to nearest triangle edge
         * Returns smaller values near triangle edges (for dark blue lines)
         */
        float edgeMin(float dx,vec2 da, vec2 db,vec2 uv){
            uv.x+=5.;
            // Use golden ratio for pseudo-random variation
            vec3 c = fract((round(vec3(uv,uv.x+uv.y)))*(vec3(0,1,2)+0.61803398875));
            
            // Optional audio reactivity for edge brightness
            float a1 = textureMirror(iChannel0,vec2(c.y,0.)).x>.6?.15:1.;
            float a2 = textureMirror(iChannel0,vec2(c.x,0.)).x>.6?.15:1.;
            float a3 = textureMirror(iChannel0,vec2(c.z,0.)).x>.6?.15:1.;
        
            // Return minimum distance to any of the three triangle edges
            return min(min((1.-dx)*db.y*a3,da.x*a2),da.y*a1);
        }
        
        /**
         * Triangular noise function
         * Creates a procedural terrain pattern using triangular tessellation
         * Returns vec2: (noise value, edge distance for wireframe)
         */
        vec2 trinoise(vec2 uv){
            // Transform to triangular grid space
            const float sq = sqrt(3./2.);
            uv.x *= sq;
            uv.y -= .5*uv.x;
            
            vec2 d = fract(uv);  // Get fractional part (position within triangle)
            uv -= d;             // Get integer part (which triangle)
        
            // Determine which half of the square we're in
            bool c = dot(d,vec2(1))>1.;
        
            // Calculate distances to triangle edges
            vec2 dd = 1.-d;
            vec2 da = c?dd:d,db = c?d:dd;
            
            // Sample hash at triangle corners
            float nn = hash(uv+float(c));
            float n2 = hash(uv+vec2(1,0));
            float n3 = hash(uv+vec2(0,1));
        
            // Interpolate noise values across triangle
            float nmid = mix(n2,n3,d.y);
            float ns = mix(nn,c?n2:n3,da.y);
            float dx = da.x/db.y;
            
            return vec2(mix(ns,nmid,dx),edgeMin(dx,da, db,uv+d));
        }
        
        
        /**
         * Scene distance function (SDF)
         * Maps a 3D point to signed distance and edge distance
         * Returns vec2: (distance to surface, edge distance for lines)
         */
        vec2 map(vec3 p){
            vec2 n = trinoise(p.xz);  // Sample 2D noise at XZ position
            return vec2(p.y-2.*n.x,n.y);  // Height field: y minus scaled noise
        }
        
        /**
         * Calculate surface normal using gradient
         * Samples map function at 3 nearby points to approximate derivative
         * Returns normalized surface normal vector
         */
        vec3 grad(vec3 p){
            const vec2 e = vec2(.005,0);  // Small offset for finite differences
            float a = map(p).x;
            // Calculate gradient in X, Y, Z directions
            return vec3(map(p+e.xyy).x-a,
                        map(p+e.yxy).x-a,
                        map(p+e.yyx).x-a)/e.x;
        }
        
        /**
         * Ray marching intersection function
         * Traces a ray through the scene to find where it hits the terrain
         * Uses sphere tracing (advancing by half the distance field value)
         * 
         * Parameters:
         *   ro: Ray origin (camera position)
         *   rd: Ray direction (normalized)
         * Returns:
         *   vec2(distance traveled, edge distance) or vec2(-1) if no hit
         */
        vec2 intersect(vec3 ro,vec3 rd){
            float d = 0.;  // Distance traveled along ray
            float h = 0.;  // Height at current position
            
            // Ray march loop (500 iterations max, 50 is often sufficient)
            for(int i = 0;i<500;i++){
                vec3 p = ro+d*rd;  // Current position along ray
                vec2 s = map(p);    // Sample distance field
                h = s.x;
                d += h*.5;          // Advance by half distance (conservative step)
                
                // Hit surface if very close (scaled by distance for precision)
                if(abs(h)<.003*d)
                    return vec2(d,s.y);
                
                // Stop if ray goes too far or above horizon
                if(d>150.|| p.y>2.) break;
            }
            
            return vec2(-1);  // No intersection found
        }
        
        
        /**
         * Add sun to the sky
         * Creates a sun disc with horizontal bands (synthwave aesthetic)
         * Modifies the color in-place
         * 
         * Parameters:
         *   rd: Ray direction
         *   ld: Light direction (sun position)
         *   col: Current color (modified in-place)
         */
        void addsun(vec3 rd,vec3 ld,inout vec3 col){
            // Calculate sun disc based on angular distance from light direction
            float sun = smoothstep(.21,.2,distance(rd,ld));
            
            if(sun>0.){
                float yd = (rd.y-ld.y);  // Vertical offset from sun center
        
                // Create horizontal bands using exponential sine wave
                float a = sin(3.1*exp(-(yd)*14.)); 
        
                // Apply band pattern to sun intensity
                sun*=smoothstep(-.8,0.,a);
        
                // Mix in warm yellow-orange sun color
                col = mix(col,vec3(1.,.8,.4)*.75,sun);
            }
        }
        
        
        /**
         * Generate procedural starfield
         * Creates multiple layers of stars with variation in size/brightness
         * Uses hash function to randomly place stars in sky
         * 
         * Parameters:
         *   rd: Ray direction (where we're looking in the sky)
         * Returns:
         *   Star brightness (0-1)
         */
        float starnoise(vec3 rd){
            float c = 0.;  // Accumulated star brightness
            vec3 p = normalize(rd)*300.;  // Scale up to large sphere
            
            // Create 4 layers of stars at different scales
            for (float i=0.;i<4.;i++)
            {
                vec3 q = fract(p)-.5;  // Position within cell
                vec3 id = floor(p);     // Cell ID
                
                // Create point star (bright at center, fading out)
                float c2 = smoothstep(.5,0.,length(q));
                
                // Randomly place stars (fewer stars in each successive layer)
                c2 *= step(hash21(id.xz/id.y),.06-i*i*0.005);
                c += c2;
                
                // Rotate and scale for next layer (creates variation)
                p = p*.6+.5*p*mat3(3./5.,0,4./5.,0,1,0,-4./5.,0,3./5.);
            }
            
            c*=c;  // Square for contrast
            
            // Add noise pattern to create star clusters
            float g = dot(sin(rd*10.512),cos(rd.yzx*10.512));
            c*=smoothstep(-3.14,-.9,g)*.5+.5*smoothstep(-.3,1.,g);
            
            return c*c;  // Square again for more contrast
        }
        
        /**
         * Generate sky color
         * Creates the gradient sky with haze, stars, and optional city
         * 
         * Parameters:
         *   rd: Ray direction
         *   ld: Light direction (sun position)
         *   mask: If true, add sun and stars (false when rendering reflections)
         * Returns:
         *   Sky color (RGB)
         */
        vec3 gsky(vec3 rd,vec3 ld,bool mask){
            // Calculate atmospheric haze (more haze near horizon)
            float haze = exp2(-5.*(abs(rd.y)-.2*dot(rd,ld)));
            
            // Generate stars (only where not obscured by haze)
            // Alternative texture-based star methods commented out
            //float st = mask?pow512(texture(iChannel0,(rd.xy+vec2(300.1,100)*rd.z)*10.).r)*(1.-min(haze,1.)):0.;
            //float st = mask?pow512(hash21((rd.xy+vec2(300.1,100)*rd.z)*10.))*(1.-min(haze,1.)):0.;
            float st = mask?(starnoise(rd))*(1.-min(haze,1.)):0.;
            
            // Background sky color (purple/blue gradient with optional audio reactivity)
            vec3 back = vec3(.4,.1,.7)*(1.-.5*textureMirror(iChannel0,vec2(.5+.05*rd.x/rd.y,0.)).x
            *exp2(-.1*abs(length(rd.xz)/rd.y))
            *max(sign(rd.y),0.));
            
            #ifdef city
            // Optional city silhouette at horizon
            float x = round(rd.x*30.);
            float h = hash21(vec2(x-166.));
            bool building = (h*h*.125*exp2(-x*x*x*x*.0025)>rd.y);
            if(mask && building)
                back*=0.,haze=.8, mask=mask && !building;
            #endif
            
            // Combine background with pink/purple haze and stars
            vec3 col=clamp(mix(back,vec3(.7,.1,.4),haze)+st,0.,1.);
            
            // Add sun if this is the main sky (not a reflection)
            if(mask)addsun(rd,ld,col);
            
            return col;  
        }
        
        
        /**
         * MAIN IMAGE - Per-pixel rendering function
         * Called once for each pixel on the screen
         * Implements ray marching, lighting, and post-processing
         * 
         * Parameters:
         *   fragColor: Output color for this pixel
         *   fragCoord: Pixel coordinates (x, y)
         */
        void mainImage( out vec4 fragColor, in vec2 fragCoord )
        {
            fragColor=vec4(0);  // Initialize output
            
            // Optional anti-aliasing loop (renders each pixel multiple times)
            #ifdef AA
            for(float x = 0.;x<1.;x+=1./float(AA)){
            for(float y = 0.;y<1.;y+=1./float(AA)){
            #else
                const float AA=1.,x=0.,y=0.;  // No AA: single sample per pixel
            #endif
            
            // Convert pixel coordinates to normalized device coordinates (-1 to 1)
            // Aspect ratio corrected to Y axis
            vec2 uv = (2.*(fragCoord+vec2(x,y))-iResolution.xy)/iResolution.y;
            
            // Motion blur: add random time offset per pixel
            const float shutter_speed = .25;
            //float dt = fract(texture(iChannel0,float(AA)*(fragCoord+vec2(x,y))/iChannelResolution[0].xy).r+iTime)*shutter_speed;
            float dt = fract(hash21(float(AA)*(fragCoord+vec2(x,y)))+iTime)*shutter_speed;
            jTime = mod(iTime-dt*iTimeDelta,4000.);  // Time with motion blur offset
            
            // Camera position: moves forward through scene
            vec3 ro = vec3(0.,1,(-20000.+jTime*speed));
            
                #ifdef stereo
                    // Stereo 3D mode: offset camera and adjust UV
                    ro+=stereo*vec3(.2*(float(uv.x>0.)-.5),0.,0.); 
                    const float de = .9;
                    uv.x=uv.x+.5*(uv.x>0.?-de:de);
                    uv*=2.;
				#endif
                
            // Ray direction: from camera through pixel
            // Using 4:3 aspect ratio for FOV
            vec3 rd = normalize(vec3(uv,4./3.));
            
            // Ray march to find intersection with terrain
            vec2 i = intersect(ro,rd);
            float d = i.x;  // Distance to intersection
            
            // Light direction (sun): slightly animated up/down
            vec3 ld = normalize(vec3(0,.125+.05*sin(.1*jTime),1));
        
            // Calculate distance fog (purple/pink tint, denser with distance)
            vec3 fog = d>0.?exp2(-d*vec3(.14,.1,.28)):vec3(0.);
            
            // Get sky color (no sun if we hit terrain, as it's behind it)
            vec3 sky = gsky(rd,ld,d<0.);
            
            // Calculate surface point and normal
            vec3 p = ro+d*rd;  // 3D position where ray hit terrain
            vec3 n = normalize(grad(p));  // Surface normal
            
            // Simple diffuse lighting (dot product of normal and light direction)
            float diff = dot(n,ld)+.1*n.y;  // Add slight upward bias
            vec3 col = vec3(.1,.11,.18)*diff;  // Dark blue-gray base color
            
            // Calculate reflection
            vec3 rfd = reflect(rd,n);  // Reflected ray direction
            vec3 rfcol = gsky(rfd,ld,true);  // Sample sky in reflection direction
            
            // Apply Fresnel effect (more reflective at glancing angles)
            col = mix(col,rfcol,.05+.95*pow(max(1.+dot(rd,n),0.),5.));
            
            #ifdef VAPORWAVE
            // Vaporwave color mode: brighter blue grid lines
            col = mix(col,vec3(.4,.5,1.),smoothstep(.05,.0,i.y));
            col = mix(sky,col,fog);
            col = sqrt(col);  // Gamma correction for vaporwave look
            #else
            // Default: Dark blue grid lines for wireframe effect
            col = mix(col,vec3(.05,.1,.35),smoothstep(.05,.0,i.y));
            col = mix(sky,col,fog);  // Blend terrain with sky based on fog
            //no gamma for that old cg look
            #endif
            
            // Handle rays that didn't hit anything
            if(d<0.)
                d=1e6;  // Very far distance
            d=min(d,10.);  // Clamp for alpha calculation
            
            // Accumulate color with depth-based alpha
            fragColor += vec4(clamp(col,0.,1.),d<0.?0.:.1+exp2(-d));
             #ifdef AA
            }  // End AA Y loop
            }  // End AA X loop
            fragColor/=float(AA*AA);  // Average all samples
            #endif
        }
        
        /**
         * GLSL entry point
         * WebGL calls this for each pixel, we forward to mainImage
         */
        void main() {
            mainImage(gl_FragColor, gl_FragCoord.xy);
        }
    `;

    // ============================================================
    // SHADER PROGRAM INITIALIZATION
    // ============================================================
    
    // Compile and link shaders into a program
    const shaderProgram = initShaderProgram(gl, vsSource, fsSource);
    
    // Store program info for later use
    programInfo = {
        program: shaderProgram,
        attribLocations: {
            // Location of vertex position attribute in vertex shader
            vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
        },
        uniformLocations: {
            // Locations of uniforms we'll pass to fragment shader
            iResolution: gl.getUniformLocation(shaderProgram, 'iResolution'),
            iTime: gl.getUniformLocation(shaderProgram, 'iTime'),
            iTimeDelta: gl.getUniformLocation(shaderProgram, 'iTimeDelta'),
            iChannel0: gl.getUniformLocation(shaderProgram, 'iChannel0'),
        },
    };

    // Create vertex buffers for full-screen quad
    buffers = initBuffers(gl);
    
    // Create a dummy 1x1 black texture for iChannel0 (audio input placeholder)
    const dummyTexture = createDummyTexture(gl);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, dummyTexture);
    
    // Start animation loop
    requestAnimationFrame(render);
}

/**
 * Initialize shader program from vertex and fragment shader source
 * Compiles both shaders and links them into a WebGL program
 * 
 * @param {WebGLRenderingContext} gl - WebGL context
 * @param {string} vsSource - Vertex shader GLSL source code
 * @param {string} fsSource - Fragment shader GLSL source code
 * @returns {WebGLProgram} Compiled and linked shader program
 */
function initShaderProgram(gl, vsSource, fsSource) {
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

    // Create the shader program
    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    // Check if linking succeeded
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        console.error('Unable to initialize shader program: ' + gl.getProgramInfoLog(shaderProgram));
        return null;
    }

    return shaderProgram;
}

/**
 * Load and compile a shader from source code
 * 
 * @param {WebGLRenderingContext} gl - WebGL context
 * @param {number} type - Shader type (gl.VERTEX_SHADER or gl.FRAGMENT_SHADER)
 * @param {string} source - GLSL shader source code
 * @returns {WebGLShader} Compiled shader
 */
function loadShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    // Check if compilation succeeded
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }

    return shader;
}

/**
 * Create a dummy 1x1 black texture for audio input placeholder
 * This prevents errors when audio features are enabled but no audio is provided
 * 
 * @param {WebGLRenderingContext} gl - WebGL context
 * @returns {WebGLTexture} 1x1 black texture
 */
function createDummyTexture(gl) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    
    // Create a 1x1 black pixel
    const pixel = new Uint8Array([0, 0, 0, 255]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    
    // Set texture parameters (no filtering needed for 1x1)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    
    return texture;
}

/**
 * Initialize vertex buffers for a full-screen quad
 * Creates two triangles covering the entire screen from -1 to 1
 * 
 * @param {WebGLRenderingContext} gl - WebGL context
 * @returns {Object} Object containing position buffer
 */
function initBuffers(gl) {
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    
    // Full-screen quad vertices (two triangles in a strip)
    // Top-left, top-right, bottom-left, bottom-right
    const positions = [
        -1.0,  1.0,  // Top-left
         1.0,  1.0,  // Top-right
        -1.0, -1.0,  // Bottom-left
         1.0, -1.0,  // Bottom-right
    ];

    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    return {
        position: positionBuffer,
    };
}

/**
 * Resize canvas to match its display size
 * Called on window resize and initialization
 * Updates WebGL viewport to match new canvas size
 */
function resizeCanvas() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    if (gl) {
        gl.viewport(0, 0, canvas.width, canvas.height);
    }
}

/**
 * Main render loop
 * Called every frame via requestAnimationFrame
 * Updates uniforms and draws the full-screen quad
 */
function render() {
    const now = Date.now();
    const currentTime = (now - startTime) / 1000.0;  // Time in seconds
    const deltaTime = (now - lastTime) / 1000.0;      // Frame delta time
    lastTime = now;

    // Clear screen to black
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Use our shader program
    gl.useProgram(programInfo.program);

    // Pass time and resolution uniforms to shader
    gl.uniform2f(programInfo.uniformLocations.iResolution, canvas.width, canvas.height);
    gl.uniform1f(programInfo.uniformLocations.iTime, currentTime);
    gl.uniform1f(programInfo.uniformLocations.iTimeDelta, deltaTime);
    gl.uniform1i(programInfo.uniformLocations.iChannel0, 0);  // Bind texture unit 0

    // Bind and setup vertex position buffer
    {
        const numComponents = 2;  // 2D positions (x, y)
        const type = gl.FLOAT;     // 32-bit floats
        const normalize = false;    // Don't normalize
        const stride = 0;          // 0 = use type and numComponents
        const offset = 0;          // Start at beginning of buffer
        
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
        gl.vertexAttribPointer(
            programInfo.attribLocations.vertexPosition,
            numComponents,
            type,
            normalize,
            stride,
            offset
        );
        gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);
    }

    // Draw the full-screen quad
    {
        const offset = 0;
        const vertexCount = 4;  // 4 vertices form 2 triangles
        gl.drawArrays(gl.TRIANGLE_STRIP, offset, vertexCount);
    }

    // Request next frame
    requestAnimationFrame(render);
}

// ============================================================
// AUTO-INITIALIZATION
// ============================================================
// Start shader when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initShader);
} else {
    initShader();  // DOM already loaded, start immediately
}
