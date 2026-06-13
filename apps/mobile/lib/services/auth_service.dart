import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

/// SHAHID Auth Service
/// Handles login, token storage, and session management.
class AuthService {
  static const String _apiBase = 'http://10.0.2.2:3001/api/v1';
  static const String _tokenKey = 'shahid_auth_token';
  static const String _refreshTokenKey = 'shahid_refresh_token';
  static const String _userKey = 'shahid_user';

  Future<Map<String, dynamic>?> login(String email, String password) async {
    final response = await http.post(
      Uri.parse('$_apiBase/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email, 'password': password}),
    );

    if (response.statusCode == 200) {
      final body = jsonDecode(response.body);
      final token = body['token'] as String?;
      final refreshToken = body['refresh_token'] as String?;
      final user = body['user'] as Map<String, dynamic>?;

      if (token != null) {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(_tokenKey, token);
        if (refreshToken != null) {
          await prefs.setString(_refreshTokenKey, refreshToken);
        }
        if (user != null) {
          await prefs.setString(_userKey, jsonEncode(user));
        }
      }
      return user;
    }
    return null;
  }

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
    await prefs.remove(_refreshTokenKey);
    await prefs.remove(_userKey);
  }

  Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_tokenKey);
  }

  Future<Map<String, dynamic>?> getUser() async {
    final prefs = await SharedPreferences.getInstance();
    final userStr = prefs.getString(_userKey);
    if (userStr != null) {
      return jsonDecode(userStr) as Map<String, dynamic>;
    }
    return null;
  }

  Future<bool> isAuthenticated() async {
    final token = await getToken();
    return token != null && token.isNotEmpty;
  }
}
