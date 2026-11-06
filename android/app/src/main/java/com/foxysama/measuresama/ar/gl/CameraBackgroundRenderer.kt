package com.foxysama.measuresama.ar.gl

import android.opengl.GLES11Ext
import android.opengl.GLES20
import com.google.ar.core.Coordinates2d
import com.google.ar.core.Frame
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer

/**
 * Draws the ARCore camera image as a full-screen quad (OpenGL ES 2.0).
 * GL THREAD ONLY: create in onSurfaceCreated, draw in onDrawFrame.
 *
 * ARCore writes each camera frame into an external OES texture that we own; ARCore also tells us
 * which texture coordinates map to the screen corners for the current display rotation and crop.
 */
class CameraBackgroundRenderer {
    /** OpenGL name of the camera texture; pass it to Session.setCameraTextureName. */
    var textureId = 0
        private set

    val isReady: Boolean get() = program != 0

    private var program = 0
    private var positionAttrib = 0
    private var texCoordAttrib = 0
    private var textureUniform = 0

    // Screen corners in normalised device coordinates, drawn as a triangle strip.
    private val screenCorners = floatArrayOf(-1f, -1f, 1f, -1f, -1f, 1f, 1f, 1f)
    private val cameraUv = FloatArray(8)
    private val positionBuffer = floatBuffer(screenCorners.size).apply { put(screenCorners).position(0) }
    private val uvBuffer = floatBuffer(cameraUv.size)

    /** Creates the texture and shader program. Throws if the GPU rejects the shaders. */
    fun createOnGlThread() {
        val textures = IntArray(1)
        GLES20.glGenTextures(1, textures, 0)
        textureId = textures[0]
        val target = GLES11Ext.GL_TEXTURE_EXTERNAL_OES
        GLES20.glBindTexture(target, textureId)
        GLES20.glTexParameteri(target, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE)
        GLES20.glTexParameteri(target, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE)
        GLES20.glTexParameteri(target, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
        GLES20.glTexParameteri(target, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR)
        GLES20.glBindTexture(target, 0)

        val vertex = compile(GLES20.GL_VERTEX_SHADER, VERTEX_SHADER)
        val fragment = compile(GLES20.GL_FRAGMENT_SHADER, FRAGMENT_SHADER)
        val linked = GLES20.glCreateProgram()
        GLES20.glAttachShader(linked, vertex)
        GLES20.glAttachShader(linked, fragment)
        GLES20.glLinkProgram(linked)
        GLES20.glDeleteShader(vertex)
        GLES20.glDeleteShader(fragment)
        val status = IntArray(1)
        GLES20.glGetProgramiv(linked, GLES20.GL_LINK_STATUS, status, 0)
        if (status[0] == 0) {
            val log = GLES20.glGetProgramInfoLog(linked)
            GLES20.glDeleteProgram(linked)
            throw IllegalStateException("Camera background program failed to link: $log")
        }
        program = linked
        positionAttrib = GLES20.glGetAttribLocation(program, "a_Position")
        texCoordAttrib = GLES20.glGetAttribLocation(program, "a_CameraUv")
        textureUniform = GLES20.glGetUniformLocation(program, "u_Camera")
    }

    /** Draws the camera image for [frame]. Call after Session.update(). */
    fun draw(frame: Frame) {
        if (frame.hasDisplayGeometryChanged()) {
            // Ask ARCore which part of the camera image belongs at each screen corner.
            frame.transformCoordinates2d(
                Coordinates2d.OPENGL_NORMALIZED_DEVICE_COORDINATES,
                screenCorners,
                Coordinates2d.TEXTURE_NORMALIZED,
                cameraUv,
            )
            uvBuffer.position(0)
            uvBuffer.put(cameraUv).position(0)
        }
        // No camera image yet (first frames after resume).
        if (frame.timestamp == 0L) return

        GLES20.glDisable(GLES20.GL_DEPTH_TEST)
        GLES20.glDepthMask(false)
        GLES20.glUseProgram(program)
        GLES20.glActiveTexture(GLES20.GL_TEXTURE0)
        GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, textureId)
        GLES20.glUniform1i(textureUniform, 0)
        GLES20.glVertexAttribPointer(positionAttrib, 2, GLES20.GL_FLOAT, false, 0, positionBuffer)
        GLES20.glVertexAttribPointer(texCoordAttrib, 2, GLES20.GL_FLOAT, false, 0, uvBuffer)
        GLES20.glEnableVertexAttribArray(positionAttrib)
        GLES20.glEnableVertexAttribArray(texCoordAttrib)
        GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4)
        GLES20.glDisableVertexAttribArray(positionAttrib)
        GLES20.glDisableVertexAttribArray(texCoordAttrib)
        GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, 0)
        GLES20.glDepthMask(true)
        GLES20.glEnable(GLES20.GL_DEPTH_TEST)
    }

    private fun compile(type: Int, source: String): Int {
        val shader = GLES20.glCreateShader(type)
        GLES20.glShaderSource(shader, source)
        GLES20.glCompileShader(shader)
        val status = IntArray(1)
        GLES20.glGetShaderiv(shader, GLES20.GL_COMPILE_STATUS, status, 0)
        if (status[0] == 0) {
            val log = GLES20.glGetShaderInfoLog(shader)
            GLES20.glDeleteShader(shader)
            throw IllegalStateException("Camera background shader failed to compile: $log")
        }
        return shader
    }

    private companion object {
        fun floatBuffer(size: Int): FloatBuffer =
            ByteBuffer.allocateDirect(size * Float.SIZE_BYTES).order(ByteOrder.nativeOrder()).asFloatBuffer()

        const val VERTEX_SHADER = """
            attribute vec4 a_Position;
            attribute vec2 a_CameraUv;
            varying vec2 v_CameraUv;
            void main() {
                gl_Position = a_Position;
                v_CameraUv = a_CameraUv;
            }
        """

        // The #extension line must come first in the shader, so the string starts with it.
        const val FRAGMENT_SHADER = """#extension GL_OES_EGL_image_external : require
            precision mediump float;
            uniform samplerExternalOES u_Camera;
            varying vec2 v_CameraUv;
            void main() {
                gl_FragColor = texture2D(u_Camera, v_CameraUv);
            }
        """
    }
}
