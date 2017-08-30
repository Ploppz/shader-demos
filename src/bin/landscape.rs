#[macro_use]
extern crate gfx;
extern crate gfx_window_glutin;
extern crate glutin;
extern crate cgmath;

use cgmath::{Matrix4, Vector3, Quaternion, Rad, One, Rotation3};

use gfx::traits::FactoryExt;
use gfx::Device;
use glutin::GlContext;

const ANIMATION_SPEED: f32 = 1.0/50000.0; // Texture units per ms

pub type ColorFormat = gfx::format::Srgba8;
pub type DepthFormat = gfx::format::DepthStencil;

gfx_defines!{
    vertex Vertex {
        pos: [f32; 2] = "v_Pos",
        texpos: [f32; 3] = "v_Texpos",
    }

    constant TimeVariant {
        transform: [[f32; 4];4] = "u_Transform",
        scale: f32 = "u_Scale",
    }

    pipeline pipe {
        vbuf: gfx::VertexBuffer<Vertex> = (),
        transform: gfx::Global<[[f32;4];4]> = "u_Transform",
        scale: gfx::Global<f32> = "u_Scale",
        out: gfx::RenderTarget<ColorFormat> = "Target0",
    }
}

const QUAD: [Vertex; 6] = [
    Vertex { pos: [ -1.0, -1.0 ], texpos: [0.0, 1.0, 2.0]},
    Vertex { pos: [  1.0, -1.0 ], texpos: [1.0, 1.0, 2.0]},
    Vertex { pos: [  1.0,  1.0 ], texpos: [1.0, 0.0, 2.0]},

    Vertex { pos: [ -1.0, -1.0 ], texpos: [0.0, 1.0, 2.0]},
    Vertex { pos: [  1.0,  1.0 ], texpos: [1.0, 0.0, 2.0]},
    Vertex { pos: [ -1.0,  1.0 ], texpos: [0.0, 0.0, 2.0]},
];

const CLEAR_COLOR: [f32; 4] = [0.1, 0.2, 0.3, 1.0];

pub fn main() {
    let mut elapsed_time = 0.0;
    let random_angle = 0.0;

    let mut events_loop = glutin::EventsLoop::new();
    let window_config = glutin::WindowBuilder::new()
        .with_title("Landscape".to_string())
        .with_dimensions(1024, 768);
    let context = glutin::ContextBuilder::new()
        .with_vsync(true);
    let (window, mut device, mut factory, main_color, mut main_depth) =
        gfx_window_glutin::init::<ColorFormat, DepthFormat>(window_config, context, &events_loop);
    let mut encoder: gfx::Encoder<_, _> = factory.create_command_buffer().into();
    let pso = factory.create_pipeline_simple(
        include_bytes!("shaders/landscape.vert"),
        include_bytes!("shaders/landscape.frag"),
        pipe::new()
    ).unwrap();
    let (vertex_buffer, slice) = factory.create_vertex_buffer_with_slice(&QUAD, ());
    let (w, h) = window.get_inner_size().unwrap();
    let mut data = pipe::Data {
        vbuf: vertex_buffer,
        transform: make_transform(0.0, w as f32, h as f32, random_angle).into(),
        scale: get_scale(w as f32, h as f32),
        out: main_color
    };

    let mut running = true;
    while running {
        // fetch events
        events_loop.poll_events(|event| {
            if let glutin::Event::WindowEvent { event, .. } = event {
                match event {
                    glutin::WindowEvent::KeyboardInput {
                        input: glutin::KeyboardInput {
                            virtual_keycode: Some(glutin::VirtualKeyCode::Escape), ..
                        }, ..
                    }
                    | glutin::WindowEvent::Closed
                        => running = false,
                    glutin::WindowEvent::Resized(width, height) => {
                        window.resize(width, height);
                        gfx_window_glutin::update_views(&window, &mut data.out, &mut main_depth);
                    },
                    _ => (),
                }
            }
        });

        let (w, h) = window.get_inner_size().unwrap();
        let (w, h) = (w as f32, h as f32);
        // Update uniforms
        elapsed_time += 10.0;
        let transform = make_transform(elapsed_time, w, h, random_angle);
        let scale = get_scale(w, h);
        data.transform = transform.into();
        data.scale = scale;

        // draw a frame
        encoder.clear(&data.out, CLEAR_COLOR);
        encoder.draw(&slice, &pso, &data);
        encoder.flush(&mut device);
        window.swap_buffers().unwrap();
        device.cleanup();
    }
}

fn make_transform(elapsed_time: f32, width: f32, height: f32, random_angle: f32) -> Matrix4<f32> {
    // "The thought is to scale, translate then rotate. Not sure why I have to rotate before translation

    // Scale to fit aspect ratio of screen
    let mut matrix = if width > height {
        Matrix4::<f32>::one() * Matrix4::from_nonuniform_scale(width/height, 1.0, 1.0)
    } else {
        Matrix4::<f32>::one() * Matrix4::from_nonuniform_scale(1.0, height/width, 1.0)
    };

    // Rotate to unalign the traversing plane with the grid. Also serves to randomize
    matrix = matrix * Matrix4::from(Quaternion::from_axis_angle(Vector3::new(1.0, 0.0, 0.0), Rad (random_angle)));

    // Translate to animate the noise - (will happen before rotation..)
    let translation = elapsed_time * ANIMATION_SPEED;
    matrix = matrix * Matrix4::from_translation(Vector3::new(0.0, 0.0, translation));
    matrix

}
fn get_scale(width: f32, height: f32) -> f32 {
    if width > height {
        height
    } else {
        width
    }
}
