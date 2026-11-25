import java.lang.classfile.ClassFile;
import java.lang.classfile.ClassModel;
import java.lang.classfile.ClassTransform;
import java.lang.classfile.CodeBuilder;
import java.lang.classfile.CodeElement;
import java.lang.classfile.CodeTransform;
import java.lang.classfile.MethodTransform;
import java.lang.constant.ClassDesc;
import java.lang.constant.ConstantDescs;
import java.lang.constant.MethodTypeDesc;

/**
 * В начало KeyboardHandler.keyPress(long window, int action, KeyEvent event) добавляем
 * вызов BeluvuFriendsAgent.onKey(event, action). Слоты локалов: 0 = this, 1-2 = long window,
 * 3 = int action, 4 = KeyEvent event.
 */
final class KeyHook {
    static final String TARGET = "net/minecraft/client/KeyboardHandler";
    private static final ClassDesc AGENT = ClassDesc.of("BeluvuFriendsAgent");
    private static final MethodTypeDesc ON_KEY =
        MethodTypeDesc.of(ConstantDescs.CD_void, ConstantDescs.CD_Object, ConstantDescs.CD_int);

    static byte[] patch(byte[] bytes) {
        ClassFile cf = ClassFile.of();
        ClassModel model = cf.parse(bytes);
        return cf.transform(model, ClassTransform.transformingMethods(
            mm -> mm.methodName().equalsString("keyPress"),
            MethodTransform.transformingCode(new InjectFirst())));
    }

    /** Вставляет вызов перед первым элементом тела метода, один раз. */
    static final class InjectFirst implements CodeTransform {
        private boolean done;

        @Override
        public void accept(CodeBuilder b, CodeElement e) {
            if (!done) {
                done = true;
                b.aload(4);
                b.iload(3);
                b.invokestatic(AGENT, "onKey", ON_KEY);
            }
            b.with(e);
        }
    }
}
