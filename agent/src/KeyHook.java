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
 * В начало KeyboardHandler.keyPress(long window, int action, KeyEvent event) добавляем:
 *   BiConsumer cb = (BiConsumer) System.getProperties().get("beluvu.onKey");
 *   cb.accept(event, Integer.valueOf(action));
 * Классы агента игре не видны (Fabric), поэтому вызываем только java.base и callback из системных свойств.
 * Слоты локалов: 0 = this, 1-2 = long window, 3 = int action, 4 = KeyEvent event.
 * Агент должен положить callback в свойства ДО регистрации трансформера.
 */
final class KeyHook {
    static final String TARGET = "net/minecraft/client/KeyboardHandler";
    static final String PROP = "beluvu.onKey";

    private static final ClassDesc SYSTEM = ClassDesc.of("java.lang.System");
    private static final ClassDesc HASHTABLE = ClassDesc.of("java.util.Hashtable");
    private static final ClassDesc BICONSUMER = ClassDesc.of("java.util.function.BiConsumer");
    private static final ClassDesc INTEGER = ClassDesc.of("java.lang.Integer");

    static byte[] patch(byte[] bytes) {
        ClassFile cf = ClassFile.of();
        ClassModel model = cf.parse(bytes);
        return cf.transformClass(model, ClassTransform.transformingMethods(
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
                b.invokestatic(SYSTEM, "getProperties", MethodTypeDesc.of(ClassDesc.of("java.util.Properties")));
                b.ldc(PROP);
                b.invokevirtual(HASHTABLE, "get", MethodTypeDesc.of(ConstantDescs.CD_Object, ConstantDescs.CD_Object));
                b.checkcast(BICONSUMER);
                b.aload(4);
                b.iload(3);
                b.invokestatic(INTEGER, "valueOf", MethodTypeDesc.of(INTEGER, ConstantDescs.CD_int));
                b.invokeinterface(BICONSUMER, "accept",
                    MethodTypeDesc.of(ConstantDescs.CD_void, ConstantDescs.CD_Object, ConstantDescs.CD_Object));
            }
            b.with(e);
        }
    }
}
