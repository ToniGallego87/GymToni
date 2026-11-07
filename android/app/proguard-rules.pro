# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Add any project specific keep options here:

# expo-notifications guarda cada aviso programado (fin de descanso,
# recordatorios, peso) con serialización de Java en SharedPreferences.
# `NotificationContent` lo hace con writeObject/readObject privados, que nadie
# llama directamente: sin esto R8 los quita, el `data` del aviso (un JSONObject)
# no se puede serializar y el aviso no llega a programarse.
-keep class expo.modules.notifications.** implements java.io.Serializable { *; }
-keepclassmembers class * implements java.io.Serializable {
  static final long serialVersionUID;
  private static final java.io.ObjectStreamField[] serialPersistentFields;
  private void writeObject(java.io.ObjectOutputStream);
  private void readObject(java.io.ObjectInputStream);
  private void readObjectNoData();
  java.lang.Object writeReplace();
  java.lang.Object readResolve();
}
