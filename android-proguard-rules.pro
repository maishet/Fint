# Reglas extra de R8/ProGuard para los builds release de Android.
# Se inyectan en android/app/proguard-rules.pro desde app.config.js
# (expo-build-properties -> android.extraProguardRules) en cada prebuild / build de EAS.

# expo-notifications trae esta misma regla en su proguard-rules.pro, pero su build.gradle
# no la publica como consumerProguardFiles, así que nunca llega al build de la app.
# Sin ella, R8 elimina los metodos privados writeObject/readObject de NotificationContent
# (se invocan por reflexion al persistir la notificacion programada en SharedPreferences)
# y scheduleNotificationAsync falla con "NotSerializableException: org.json.JSONObject":
# el switch de "Recordatorio diario" se activa y se apaga al instante en la beta.
-keep class expo.modules.notifications.** { *; }

# Red de seguridad general: conservar los hooks de serializacion Java de cualquier clase
# Serializable (otras librerias tambien persisten objetos con ObjectOutputStream).
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}
