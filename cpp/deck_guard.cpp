#include <algorithm>
#include <cctype>
#include <cstdint>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <unordered_map>
#include <vector>

namespace {

struct RawSlide {
  std::string type;
  int question_number = 0;
  int theme_id = 1;
  std::string question;
  std::string answer;
  std::string notes;
  std::string scripture;
  std::string memory;
};

struct ExportSlide {
  std::string type;
  int question_number = 0;
  std::string label;
  std::string title;
  std::string body;
};

struct Request {
  std::string main_topic;
  std::string lesson_date;
  std::string scripture_reading;
  std::string memory_verse;
  int theme_id = 1;
  std::vector<RawSlide> slides;
};

std::string trim(const std::string& input) {
  std::size_t start = 0;
  while (start < input.size() && std::isspace(static_cast<unsigned char>(input[start]))) {
    start += 1;
  }

  std::size_t end = input.size();
  while (end > start && std::isspace(static_cast<unsigned char>(input[end - 1]))) {
    end -= 1;
  }

  return input.substr(start, end - start);
}

std::string collapse_spaces(const std::string& input) {
  std::string output;
  bool pending_space = false;

  for (char ch : input) {
    const unsigned char uch = static_cast<unsigned char>(ch);
    if (ch == '\n' || ch == '\r') {
      if (!output.empty() && output.back() != '\n') {
        output.push_back('\n');
      }
      pending_space = false;
      continue;
    }

    if (std::isspace(uch)) {
      pending_space = true;
      continue;
    }

    if (pending_space && !output.empty() && output.back() != '\n') {
      output.push_back(' ');
    }
    output.push_back(ch);
    pending_space = false;
  }

  return trim(output);
}

std::string truncate_utf8_agnostic(const std::string& input, std::size_t max_length) {
  if (input.size() <= max_length) {
    return input;
  }
  return input.substr(0, max_length);
}

std::string sanitize_text(const std::string& input, std::size_t max_length) {
  std::string cleaned = collapse_spaces(input);
  cleaned.erase(std::remove(cleaned.begin(), cleaned.end(), '\0'), cleaned.end());
  return truncate_utf8_agnostic(cleaned, max_length);
}

std::string hex_decode(const std::string& hex) {
  if (hex.size() % 2 != 0) {
    throw std::runtime_error("Invalid hex payload length.");
  }

  std::string output;
  output.reserve(hex.size() / 2);

  for (std::size_t i = 0; i < hex.size(); i += 2) {
    const std::string pair = hex.substr(i, 2);
    char value = static_cast<char>(std::stoi(pair, nullptr, 16));
    output.push_back(value);
  }

  return output;
}

std::string hex_encode(const std::string& text) {
  std::ostringstream builder;
  builder << std::hex << std::setfill('0');

  for (unsigned char ch : text) {
    builder << std::setw(2) << static_cast<int>(ch);
  }

  return builder.str();
}

std::unordered_map<std::string, std::string> read_key_values_until(const std::string& terminator) {
  std::unordered_map<std::string, std::string> values;
  std::string line;

  while (std::getline(std::cin, line)) {
    if (line == terminator) {
      break;
    }

    const std::size_t separator = line.find('=');
    if (separator == std::string::npos) {
      continue;
    }

    values[line.substr(0, separator)] = line.substr(separator + 1);
  }

  return values;
}

std::uint64_t mix_hash(std::uint64_t seed, const std::string& value) {
  for (unsigned char ch : value) {
    seed ^= static_cast<std::uint64_t>(ch) + 0x9e3779b97f4a7c15ULL + (seed << 6U) + (seed >> 2U);
  }
  return seed;
}

Request read_request() {
  std::unordered_map<std::string, std::string> envelope = read_key_values_until("SLIDES_BEGIN");
  Request request;
  request.main_topic = sanitize_text(hex_decode(envelope["PROJECT_MAIN_TOPIC"]), 160);
  request.lesson_date = sanitize_text(hex_decode(envelope["PROJECT_LESSON_DATE"]), 120);
  request.scripture_reading = sanitize_text(hex_decode(envelope["PROJECT_SCRIPTURE_READING"]), 220);
  request.memory_verse = sanitize_text(hex_decode(envelope["PROJECT_MEMORY_VERSE"]), 220);
  request.theme_id = std::stoi(envelope["PROJECT_THEME_ID"]);

  std::string line;
  while (std::getline(std::cin, line)) {
    if (line == "END") {
      break;
    }

    if (line != "SLIDE_BEGIN") {
      continue;
    }

    RawSlide slide;
    std::unordered_map<std::string, std::string> raw = read_key_values_until("SLIDE_END");
    slide.type = raw["TYPE"];
    slide.question_number = std::stoi(raw["QUESTION_NUMBER"]);
    slide.theme_id = std::stoi(raw["THEME_ID"]);
    slide.question = sanitize_text(hex_decode(raw["QUESTION"]), 320);
    slide.answer = sanitize_text(hex_decode(raw["ANSWER"]), 320);
    slide.notes = sanitize_text(hex_decode(raw["NOTES"]), 420);
    slide.scripture = sanitize_text(hex_decode(raw["SCRIPTURE"]), 220);
    slide.memory = sanitize_text(hex_decode(raw["MEMORY"]), 220);
    request.slides.push_back(slide);
  }

  return request;
}

std::vector<ExportSlide> build_export_plan(const Request& request, std::uint64_t& fingerprint) {
  std::vector<ExportSlide> plan;
  int question_counter = 0;
  fingerprint = 0xcbf29ce484222325ULL;

  fingerprint = mix_hash(fingerprint, request.main_topic);
  fingerprint = mix_hash(fingerprint, request.lesson_date);
  fingerprint = mix_hash(fingerprint, request.scripture_reading);
  fingerprint = mix_hash(fingerprint, request.memory_verse);

  for (const RawSlide& slide : request.slides) {
    ExportSlide export_slide;
    export_slide.type = slide.type;

    if (slide.type == "title") {
      export_slide.label = "TITLE";
      export_slide.title = sanitize_text(slide.question.empty() ? request.main_topic : slide.question, 180);
      export_slide.body = sanitize_text(slide.answer.empty() ? request.lesson_date : slide.answer, 180);
    } else if (slide.type == "scriptureMemory") {
      export_slide.label = "READING AND MEMORY";
      export_slide.title = "Reading and Memory Verse";
      std::string body = slide.scripture.empty() ? request.scripture_reading : slide.scripture;
      if (!body.empty() && !(slide.memory.empty() && request.memory_verse.empty())) {
        body.append("\n\n");
      }
      body.append(slide.memory.empty() ? request.memory_verse : slide.memory);
      export_slide.body = sanitize_text(body, 400);
    } else if (slide.type == "note") {
      export_slide.label = "NOTE";
      export_slide.title = sanitize_text(slide.question.empty() ? "Presenter Note" : slide.question, 180);
      export_slide.body = sanitize_text(slide.notes, 500);
    } else {
      question_counter += 1;
      export_slide.type = "question";
      export_slide.question_number = question_counter;
      export_slide.label = "QUESTION " + std::to_string(question_counter);
      export_slide.title = sanitize_text(slide.question, 220);
      export_slide.body = sanitize_text(slide.answer, 320);
    }

    fingerprint = mix_hash(fingerprint, export_slide.type);
    fingerprint = mix_hash(fingerprint, export_slide.label);
    fingerprint = mix_hash(fingerprint, export_slide.title);
    fingerprint = mix_hash(fingerprint, export_slide.body);
    plan.push_back(export_slide);
  }

  return plan;
}

void write_response(const std::vector<ExportSlide>& plan, std::uint64_t fingerprint) {
  std::cout << "STATUS=OK\n";
  std::cout << "FINGERPRINT=" << std::hex << fingerprint << std::dec << "\n";
  std::cout << "SLIDE_COUNT=" << plan.size() << "\n";
  for (const ExportSlide& slide : plan) {
    std::cout << "SLIDE_BEGIN\n";
    std::cout << "TYPE=" << slide.type << "\n";
    std::cout << "QUESTION_NUMBER=" << slide.question_number << "\n";
    std::cout << "LABEL=" << hex_encode(slide.label) << "\n";
    std::cout << "TITLE=" << hex_encode(slide.title) << "\n";
    std::cout << "BODY=" << hex_encode(slide.body) << "\n";
    std::cout << "SLIDE_END\n";
  }
  std::cout << "END\n";
}

}  // namespace

int main() {
  try {
    Request request = read_request();
    std::uint64_t fingerprint = 0;
    std::vector<ExportSlide> plan = build_export_plan(request, fingerprint);
    write_response(plan, fingerprint);
    return 0;
  } catch (const std::exception& error) {
    std::cout << "STATUS=ERROR\n";
    std::cout << "MESSAGE=" << hex_encode(error.what()) << "\n";
    std::cout << "END\n";
    return 1;
  }
}
