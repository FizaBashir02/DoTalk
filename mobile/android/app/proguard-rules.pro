# Proguard rules for DoTalk React Native application
# Add your custom Proguard rules here.

# Keep React Native files and symbols
-keep class com.facebook.react.** { *; }
-keep class com.facebook.systrace.** { *; }
-dontwarn com.facebook.react.**

# Keep OkHttp & SoLoader symbols
-keep class okhttp3.** { *; }
-keep class com.facebook.soloader.** { *; }
-dontwarn okhttp3.**
-dontwarn com.facebook.soloader.**
